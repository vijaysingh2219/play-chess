import { AuthenticatedSocket, QueueEntry } from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { logger } from '@workspace/logger';
import { parseTimeControl } from '@workspace/utils';
import { redis } from '../lib/redis';
import { gameService } from './game';

const log = logger.child({ module: 'matchmaking' });

/**
 * Atomically claim a pair of players. Removes both from the queue hash and the
 * time-control index in one round-trip, but only if BOTH are still queued.
 * Returns 1 when the claim succeeds, 0 when either player was already taken.
 *
 * KEYS[1] = queue hash, KEYS[2] = time-control index (sorted set)
 * ARGV[1] = playerId, ARGV[2] = opponentId
 */
const CLAIM_PAIR_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 and redis.call('HEXISTS', KEYS[1], ARGV[2]) == 1 then
  redis.call('HDEL', KEYS[1], ARGV[1], ARGV[2])
  redis.call('ZREM', KEYS[2], ARGV[1], ARGV[2])
  return 1
end
return 0
`;

/** Release a lock only if the caller still owns it (KEYS[1] == ARGV[1]). */
const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * Matchmaking Service
 *
 * Implements a rating-based matchmaking system using a priority queue.
 * Players are matched with opponents of similar rating within an expanding range.
 */
class MatchmakingService {
  // Redis keys
  private readonly QUEUE_KEY = 'matchmaking:queue';
  private readonly QUEUE_INDEX_KEY = 'matchmaking:queue:index';
  private readonly MATCHMAKER_LOCK_KEY = 'matchmaking:matcher:lock';

  // Time-based rating range expansion
  private readonly INITIAL_RATING_RANGE = 100;
  private readonly MAX_RATING_RANGE = 400;
  private readonly RANGE_EXPANSION_PER_SECOND = 20;

  // Maximum wait time before giving up
  private readonly MAX_WAIT_TIME_MS = 120000; // 2 minutes

  /**
   * Add player to matchmaking queue
   */
  async addToQueue(
    socket: AuthenticatedSocket,
    timeControl: string,
    ratingRange?: number,
  ): Promise<void> {
    const userId = socket.data.userId;

    // Check if already in queue
    const existing = await redis.hget(this.QUEUE_KEY, userId);
    if (existing) {
      throw new Error('Already in matchmaking queue');
    }

    // Check if player is in an active game
    const activeGame = await this.hasActiveGame(userId);
    if (activeGame) {
      throw new Error('Cannot join queue while in an active game');
    }

    const entry: QueueEntry = {
      userId,
      username: socket.data.username,
      rating: socket.data.rating,
      image: socket.data.image || null,
      timeControl,
      ratingRange: ratingRange || this.INITIAL_RATING_RANGE,
      joinedAt: new Date(),
      socketId: socket.id,
    };

    // Store in Redis hash
    await redis.hset(this.QUEUE_KEY, userId, JSON.stringify(entry));

    // Add to sorted set for time-based indexing (score = timestamp)
    await redis.zadd(`${this.QUEUE_INDEX_KEY}:${timeControl}`, entry.joinedAt.getTime(), userId);

    log.info(
      { userId, username: entry.username, rating: entry.rating, timeControl },
      'joined queue',
    );
  }

  /**
   * Remove player from matchmaking queue
   */
  async removeFromQueue(userId: string): Promise<boolean> {
    // Get entry to find time control
    const entryStr = await redis.hget(this.QUEUE_KEY, userId);

    if (!entryStr) {
      return false;
    }

    const entry: QueueEntry = JSON.parse(entryStr);

    // Remove from hash
    await redis.hdel(this.QUEUE_KEY, userId);

    // Remove from sorted set
    await redis.zrem(`${this.QUEUE_INDEX_KEY}:${entry.timeControl}`, userId);

    log.info({ userId }, 'removed from queue');

    return true;
  }

  /**
   * Current rating range for an entry, expanding the longer it waits.
   */
  private currentRatingRange(entry: QueueEntry, now: number): number {
    const waitSeconds = (now - new Date(entry.joinedAt).getTime()) / 1000;
    return Math.min(
      entry.ratingRange + waitSeconds * this.RANGE_EXPANSION_PER_SECOND,
      this.MAX_RATING_RANGE,
    );
  }

  /**
   * Read the whole queue once and group players by time control, oldest first
   * within each group. Cheap because only actively-searching players are present.
   */
  async getQueueGroupedByTimeControl(): Promise<Map<string, QueueEntry[]>> {
    const all = await redis.hgetall(this.QUEUE_KEY);
    const groups = new Map<string, QueueEntry[]>();

    for (const entryStr of Object.values(all)) {
      const entry: QueueEntry = JSON.parse(entryStr);
      entry.joinedAt = new Date(entry.joinedAt);
      const group = groups.get(entry.timeControl);
      if (group) {
        group.push(entry);
      } else {
        groups.set(entry.timeControl, [entry]);
      }
    }

    for (const group of groups.values()) {
      group.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
    }

    return groups;
  }

  /**
   * Greedily pair players within a single time-control group. Oldest players are
   * matched first (fairness); each is paired with the closest-rated opponent that
   * falls within BOTH players' (time-expanded) rating ranges.
   *
   * Pure/in-memory: the returned pairs are *candidates* — callers must still
   * atomically claim each pair via {@link claimPair} before creating a game.
   */
  computeMatches(entries: QueueEntry[]): Array<{ player: QueueEntry; opponent: QueueEntry }> {
    const now = Date.now();
    const paired = new Set<string>();
    const matches: Array<{ player: QueueEntry; opponent: QueueEntry }> = [];

    for (let i = 0; i < entries.length; i++) {
      const player = entries[i];
      if (!player || paired.has(player.userId)) continue;

      let best: QueueEntry | null = null;
      let smallestDiff = Infinity;

      for (let j = i + 1; j < entries.length; j++) {
        const opponent = entries[j];
        if (!opponent || paired.has(opponent.userId)) continue;

        const ratingDiff = Math.abs(player.rating - opponent.rating);
        if (ratingDiff > this.currentRatingRange(player, now)) continue;
        if (ratingDiff > this.currentRatingRange(opponent, now)) continue;

        if (ratingDiff < smallestDiff) {
          smallestDiff = ratingDiff;
          best = opponent;
        }
      }

      if (best) {
        paired.add(player.userId);
        paired.add(best.userId);
        matches.push({ player, opponent: best });
      }
    }

    return matches;
  }

  /**
   * Atomically claim a pair: remove both players from the queue in one Redis
   * round-trip, but only if BOTH are still present. Returns true when this caller
   * won the claim (and may create the game), false if either player was already
   * taken by a concurrent matcher (possibly on another instance).
   */
  async claimPair(playerId: string, opponentId: string, timeControl: string): Promise<boolean> {
    const result = (await redis.eval(
      CLAIM_PAIR_SCRIPT,
      2,
      this.QUEUE_KEY,
      `${this.QUEUE_INDEX_KEY}:${timeControl}`,
      playerId,
      opponentId,
    )) as number;

    return result === 1;
  }

  /**
   * Try to become the matchmaker leader for one tick. Only the holder runs the
   * matching pass, so multiple instances don't duplicate work or QUEUE_STATUS
   * emits. {@link claimPair} remains the ultimate safety net.
   */
  async acquireMatchmakerLock(instanceId: string, ttlMs: number): Promise<boolean> {
    const result = await redis.set(this.MATCHMAKER_LOCK_KEY, instanceId, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /** Release the matchmaker leader lock, but only if we still own it. */
  async releaseMatchmakerLock(instanceId: string): Promise<void> {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, this.MATCHMAKER_LOCK_KEY, instanceId);
  }

  /**
   * Create a matched game between two players
   */
  async createMatchedGame(
    player1: QueueEntry,
    player2: QueueEntry,
  ): Promise<{
    gameId: string;
    whitePlayerId: string;
    blackPlayerId: string;
  }> {
    // Randomly assign colors (50/50 chance)
    const player1IsWhite = Math.random() < 0.5;
    const whitePlayerId = player1IsWhite ? player1.userId : player2.userId;
    const blackPlayerId = player1IsWhite ? player2.userId : player1.userId;

    // Parse time control (e.g., "10+0" -> 10 minutes, 0 increment)
    const { initialTimeSeconds, incrementSeconds } = parseTimeControl(player1.timeControl);
    const whiteEloAtStart = player1IsWhite ? player1.rating : player2.rating;
    const blackEloAtStart = player1IsWhite ? player2.rating : player1.rating;

    const gameId = await gameService.createGame(
      whitePlayerId,
      blackPlayerId,
      player1.timeControl,
      initialTimeSeconds,
      incrementSeconds,
      whiteEloAtStart,
      blackEloAtStart,
      'QUICK_MATCH',
      true,
    );

    // Both players were already removed from the queue by the atomic claim.

    log.info(
      {
        gameId,
        player1: { userId: player1.userId, username: player1.username },
        player2: { userId: player2.userId, username: player2.username },
      },
      'match created',
    );

    return {
      gameId,
      whitePlayerId,
      blackPlayerId,
    };
  }

  /**
   * Get queue status for a player
   */
  async getQueueStatus(userId: string): Promise<{
    position: number;
    estimatedWaitTime: number;
    playersInQueue: number;
  } | null> {
    const playerStr = await redis.hget(this.QUEUE_KEY, userId);

    if (!playerStr) {
      return null;
    }

    const player: QueueEntry = JSON.parse(playerStr);

    // Get all players with same time control, sorted by join time
    const sameTCPlayers = await redis.zrange(
      `${this.QUEUE_INDEX_KEY}:${player.timeControl}`,
      0,
      -1,
      'WITHSCORES',
    );

    // Parse results (alternating userId, score)
    const players: Array<{ userId: string; joinedAt: number }> = [];
    for (let i = 0; i < sameTCPlayers.length; i += 2) {
      const id = sameTCPlayers[i];
      const score = sameTCPlayers[i + 1] ?? '0';
      if (typeof id === 'string') {
        players.push({
          userId: id,
          joinedAt: parseFloat(score),
        });
      }
    }

    // Find position
    const position = players.findIndex((p) => p.userId === userId) + 1;

    // Estimate wait time (rough estimate: 30 seconds per player ahead)
    const estimatedWaitTime = (position - 1) * 30;

    return {
      position,
      estimatedWaitTime,
      playersInQueue: players.length,
    };
  }

  /**
   * Clean up expired queue entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const cutoff = now - this.MAX_WAIT_TIME_MS;

    // Get all entries
    const allEntries = await redis.hgetall(this.QUEUE_KEY);

    for (const [userId, entryStr] of Object.entries(allEntries)) {
      const entry: QueueEntry = JSON.parse(entryStr);
      const joinedAt = new Date(entry.joinedAt).getTime();

      if (joinedAt < cutoff) {
        log.info({ userId, username: entry.username }, 'removing stale entry from queue (timeout)');
        await this.removeFromQueue(userId);
      }
    }
  }

  /**
   * Check if player has an active game
   */
  private async hasActiveGame(userId: string): Promise<boolean> {
    const activeGame = await prisma.game.findFirst({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
        status: 'ONGOING',
      },
    });

    return !!activeGame;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    totalPlayers: number;
    averageWaitTime: number;
    timeControlDistribution: Record<string, number>;
  }> {
    const allEntries = await redis.hgetall(this.QUEUE_KEY);
    const entries = Object.values(allEntries).map((str) => {
      const entry: QueueEntry = JSON.parse(str);
      entry.joinedAt = new Date(entry.joinedAt);
      return entry;
    });

    const now = Date.now();
    const totalPlayers = entries.length;
    const averageWaitTime =
      totalPlayers > 0
        ? entries.reduce((sum, entry) => sum + (now - entry.joinedAt.getTime()), 0) /
          totalPlayers /
          1000
        : 0;

    const timeControlDistribution: Record<string, number> = {};
    for (const entry of entries) {
      timeControlDistribution[entry.timeControl] =
        (timeControlDistribution[entry.timeControl] || 0) + 1;
    }

    return {
      totalPlayers,
      averageWaitTime,
      timeControlDistribution,
    };
  }
}

// Singleton instance
export const matchmakingService = new MatchmakingService();

// Run cleanup every 30 seconds
setInterval(() => {
  matchmakingService.cleanup();
}, 30000);

// Log queue stats every 5 minutes
setInterval(
  async () => {
    const stats = await matchmakingService.getQueueStats();
    log.info({ stats }, 'queue stats');
  },
  5 * 60 * 1000,
);
