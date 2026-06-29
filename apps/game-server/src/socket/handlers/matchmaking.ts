import { AuthenticatedSocket, getUserRoomId, QueueEntry, TypedServer } from '@workspace/contracts';
import { logger } from '@workspace/logger';
import { parseTimeControl } from '@workspace/utils';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { randomUUID } from 'crypto';
import { asyncHandler } from '../middleware/error.middleware';
import { createHandler } from '../middleware/validation.middleware';
import { FindMatchPayload, FindMatchSchema } from '../schemas';
import { validateMatchmakingEligibility } from '../services/game-validation';
import { matchmakingService } from '../services/matchmaking';
import { playerManager } from '../services/player-manager';

const log = logger.child({ module: 'matchmaking' });

// Centralized matchmaker loop tuning.
const TICK_INTERVAL_MS = 1000;
const LOCK_TTL_MS = 5000;

// Identifies this process when contending for the matchmaker leader lock.
const INSTANCE_ID = randomUUID();

let matchmakerStarted = false;

export function setupMatchmakingHandlers(io: TypedServer): void {
  startMatchmaker(io);

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Find match
    socket.on(
      SOCKET_EVENTS.FIND_MATCH,
      createHandler(
        socket,
        FindMatchSchema,
        async (payload) => {
          socket.data.log.info({ payload }, 'match requested');
          await handleFindMatch(socket, payload);
        },
        { action: 'MATCHMAKING' },
      ),
    );

    // Cancel matchmaking (no payload needed)
    socket.on(
      SOCKET_EVENTS.CANCEL_MATCHMAKING,
      asyncHandler(socket, async () => {
        await handleCancelMatchmaking(socket);
      }),
    );

    // Leave the queue when the socket drops.
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      await matchmakingService.removeFromQueue(socket.data.userId);
    });
  });
}

async function handleFindMatch(
  socket: AuthenticatedSocket,
  payload: FindMatchPayload,
): Promise<void> {
  const { timeControl, ratingRange } = payload;
  const userId = socket.data.userId;

  // Time control is already validated by the Zod schema.
  await validateMatchmakingEligibility(userId);

  socket.data.log.info({ timeControl }, 'looking for game');

  await matchmakingService.addToQueue(socket, timeControl, ratingRange);

  // The centralized loop performs the actual matching; send an initial status.
  const queueStatus = await matchmakingService.getQueueStatus(userId);
  if (queueStatus) {
    socket.emit(SOCKET_EVENTS.QUEUE_STATUS, queueStatus);
  }
}

async function handleCancelMatchmaking(socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data.userId;
  const removed = await matchmakingService.removeFromQueue(userId);

  if (removed) {
    socket.data.log.info('matchmaking cancelled');
    socket.emit(SOCKET_EVENTS.MATCHMAKING_CANCELLED);
  }
}

/**
 * Start the single, centralized matchmaker loop for this process. Each tick the
 * leader (one instance fleet-wide) pairs queued players atomically and refreshes
 * everyone's queue position. The in-process `running` guard prevents overlapping
 * ticks on this instance; the Redis leader lock prevents overlap across instances.
 */
function startMatchmaker(io: TypedServer): void {
  if (matchmakerStarted) return;
  matchmakerStarted = true;

  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runMatchmakingTick(io);
    } catch (error) {
      log.error({ err: error }, 'matchmaking tick error');
    } finally {
      running = false;
    }
  }, TICK_INTERVAL_MS);

  log.info({ instanceId: INSTANCE_ID, intervalMs: TICK_INTERVAL_MS }, 'matchmaker loop started');
}

async function runMatchmakingTick(io: TypedServer): Promise<void> {
  const isLeader = await matchmakingService.acquireMatchmakerLock(INSTANCE_ID, LOCK_TTL_MS);
  if (!isLeader) return;

  try {
    const groups = await matchmakingService.getQueueGroupedByTimeControl();

    for (const [timeControl, entries] of groups) {
      const matched = new Set<string>();

      for (const { player, opponent } of matchmakingService.computeMatches(entries)) {
        const claimed = await matchmakingService.claimPair(
          player.userId,
          opponent.userId,
          timeControl,
        );
        if (!claimed) continue;

        matched.add(player.userId);
        matched.add(opponent.userId);
        await createAndAnnounceMatch(io, player, opponent);
      }

      // Refresh queue position for everyone still waiting in this group.
      emitQueueStatus(io, entries, matched);
    }
  } finally {
    await matchmakingService.releaseMatchmakerLock(INSTANCE_ID);
  }
}

async function createAndAnnounceMatch(
  io: TypedServer,
  player: QueueEntry,
  opponent: QueueEntry,
): Promise<void> {
  const gameData = await matchmakingService.createMatchedGame(player, opponent);
  const { initialMinutes, incrementSeconds } = parseTimeControl(player.timeControl);
  const initialTime = initialMinutes * 60;

  await Promise.all([
    playerManager.setUserActiveGame(player.userId, gameData.gameId),
    playerManager.setUserActiveGame(opponent.userId, gameData.gameId),
  ]);

  // Emit MATCH_FOUND to each player from their own perspective.
  for (const [me, them] of [
    [player, opponent],
    [opponent, player],
  ] as const) {
    io.to(getUserRoomId(me.userId)).emit(SOCKET_EVENTS.MATCH_FOUND, {
      gameId: gameData.gameId,
      opponent: {
        id: them.userId,
        username: them.username,
        rating: them.rating,
        image: them.image,
      },
      color: gameData.whitePlayerId === me.userId ? 'white' : 'black',
      timeControl: player.timeControl,
      initialTime,
      incrementTime: incrementSeconds,
    });
  }

  log.info(
    { gameId: gameData.gameId, player: player.userId, opponent: opponent.userId },
    'match found',
  );
}

/**
 * Emit an updated QUEUE_STATUS to each still-waiting player in a group, computed
 * from the in-memory snapshot (no extra Redis reads). Players just paired this
 * tick are in `matched` and skipped.
 */
function emitQueueStatus(io: TypedServer, entries: QueueEntry[], matched: Set<string>): void {
  const waiting = entries.filter((entry) => !matched.has(entry.userId));

  waiting.forEach((entry, index) => {
    const position = index + 1;
    io.to(getUserRoomId(entry.userId)).emit(SOCKET_EVENTS.QUEUE_STATUS, {
      position,
      estimatedWaitTime: (position - 1) * 30,
      playersInQueue: waiting.length,
    });
  });
}
