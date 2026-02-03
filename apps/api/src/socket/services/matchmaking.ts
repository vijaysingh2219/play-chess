import { prisma } from '@workspace/db';
import { parseTimeControl } from '@workspace/utils';
import { AuthenticatedSocket, QueueEntry } from '@workspace/utils/types';
import { redis } from '../lib/redis';
import { gameService } from './game';

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
  private readonly ACTIVE_GAMES_KEY = 'matchmaking:active_games';

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

    console.log(
      `[Matchmaking] ${entry.username} (${entry.rating}) joined queue for ${timeControl}`,
    );

    // Attempt to find a match immediately
    await this.findMatch(userId);
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

    console.log(`[Matchmaking] User ${userId} removed from queue`);

    return true;
  }

  /**
   * Find a match for a player
   * Uses ELO-based matching with time-based range expansion
   */
  async findMatch(userId: string): Promise<QueueEntry | null> {
    const playerStr = await redis.hget(this.QUEUE_KEY, userId);

    if (!playerStr) {
      return null;
    }

    const player: QueueEntry = JSON.parse(playerStr);
    player.joinedAt = new Date(player.joinedAt);

    // Calculate current rating range (expands over time)
    const waitTime = Date.now() - player.joinedAt.getTime();
    const waitTimeSeconds = waitTime / 1000;
    const currentRange = Math.min(
      player.ratingRange + waitTimeSeconds * this.RANGE_EXPANSION_PER_SECOND,
      this.MAX_RATING_RANGE,
    );

    // Get all players with same time control
    const opponentIds = await redis.zrange(`${this.QUEUE_INDEX_KEY}:${player.timeControl}`, 0, -1);

    // Find best opponent
    let bestOpponent: QueueEntry | null = null;
    let smallestRatingDiff = Infinity;

    for (const opponentId of opponentIds) {
      if (typeof opponentId !== 'string') continue;
      // Skip self
      if (opponentId === userId) continue;

      const opponentStr = await redis.hget(this.QUEUE_KEY, opponentId);
      if (!opponentStr) continue;

      const opponent: QueueEntry = JSON.parse(opponentStr);
      opponent.joinedAt = new Date(opponent.joinedAt);

      // Calculate rating difference
      const ratingDiff = Math.abs(player.rating - opponent.rating);

      // Check if within range
      if (ratingDiff > currentRange) continue;

      // Check if opponent's range also includes this player
      const opponentWaitTime = Date.now() - opponent.joinedAt.getTime();
      const opponentWaitSeconds = opponentWaitTime / 1000;
      const opponentCurrentRange = Math.min(
        opponent.ratingRange + opponentWaitSeconds * this.RANGE_EXPANSION_PER_SECOND,
        this.MAX_RATING_RANGE,
      );

      if (ratingDiff > opponentCurrentRange) continue;

      // Track best match (closest rating)
      if (ratingDiff < smallestRatingDiff) {
        smallestRatingDiff = ratingDiff;
        bestOpponent = opponent;
      }
    }

    return bestOpponent;
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

    // Remove both players from queue
    this.removeFromQueue(player1.userId);
    this.removeFromQueue(player2.userId);

    console.log(
      `[Matchmaking] Match created: ${player1.username} vs ${player2.username} (Game ${gameId})`,
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
   * Get all players in queue for a specific time control
   */
  async getQueueByTimeControl(timeControl: string): Promise<QueueEntry[]> {
    const userIds = await redis.zrange(`${this.QUEUE_INDEX_KEY}:${timeControl}`, 0, -1);

    const entries: QueueEntry[] = [];

    for (const userId of userIds) {
      const entryStr = await redis.hget(this.QUEUE_KEY, userId);
      if (entryStr) {
        const entry: QueueEntry = JSON.parse(entryStr);
        entry.joinedAt = new Date(entry.joinedAt);
        entries.push(entry);
      }
    }

    return entries;
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
        console.log(`[Matchmaking] Removing ${entry.username} from queue (timeout)`);
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
   * Get total players in queue
   */
  async getTotalPlayersInQueue(): Promise<number> {
    return await redis.hlen(this.QUEUE_KEY);
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
    console.log('[Matchmaking] Queue Stats:', stats);
  },
  5 * 60 * 1000,
);
