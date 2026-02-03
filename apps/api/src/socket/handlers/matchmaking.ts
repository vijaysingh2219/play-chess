import { parseTimeControl } from '@workspace/utils';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { AuthenticatedSocket, getUserRoomId, TypedServer } from '@workspace/utils/types';
import { asyncHandler } from '../middleware/error.middleware';
import { createHandler } from '../middleware/validation.middleware';
import { FindMatchPayload, FindMatchSchema } from '../schemas';
import { validateMatchmakingEligibility } from '../services/game-validation';
import { matchmakingService } from '../services/matchmaking';
import { playerManager } from '../services/player-manager';

export function setupMatchmakingHandlers(io: TypedServer): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Find match
    socket.on(
      SOCKET_EVENTS.FIND_MATCH,
      createHandler(socket, FindMatchSchema, async (payload) => {
        console.log(`[Matchmaking] ${socket.data.username} requested a match`, payload);
        await handleFindMatch(io, socket, payload);
      }),
    );

    // Cancel matchmaking (no payload needed)
    socket.on(
      SOCKET_EVENTS.CANCEL_MATCHMAKING,
      asyncHandler(socket, async () => {
        await handleCancelMatchmaking(socket);
      }),
    );
  });
}

async function handleFindMatch(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: FindMatchPayload,
): Promise<void> {
  const { timeControl, ratingRange } = payload;
  const userId = socket.data.userId;

  // Time control is already validated by Zod schema
  await validateMatchmakingEligibility(userId);

  console.log(`[Matchmaking] ${socket.data.username} looking for ${timeControl} game`);

  await playerManager.setUserStatus(userId, 'matchmaking');

  await matchmakingService.addToQueue(socket, timeControl, ratingRange);

  const queueStatus = await matchmakingService.getQueueStatus(socket.data.userId);
  if (queueStatus) {
    socket.emit(SOCKET_EVENTS.QUEUE_STATUS, queueStatus);
  }

  await tryMatchmaking(io, socket.data.userId);

  startMatchmakingLoop(io, socket);
}

async function tryMatchmaking(io: TypedServer, userId: string): Promise<boolean> {
  const opponent = await matchmakingService.findMatch(userId);

  if (!opponent) {
    return false;
  }

  const playerQueue = await matchmakingService.getQueueByTimeControl(opponent.timeControl);
  const player = playerQueue.find((p) => p.userId === userId);

  if (!player) {
    return false;
  }

  console.log(
    `[Matchmaking] Match found: ${player.username} (${player.rating}) vs ${opponent.username} (${opponent.rating})`,
  );

  const gameData = await matchmakingService.createMatchedGame(player, opponent);

  const { initialMinutes, incrementSeconds } = parseTimeControl(player.timeControl);

  const player1IsWhite = gameData.whitePlayerId === player.userId;
  const player2IsWhite = gameData.whitePlayerId === opponent.userId;

  const player1Data = {
    id: player.userId,
    username: player.username,
    rating: player.rating,
    image: player.image,
  };

  const player2Data = {
    id: opponent.userId,
    username: opponent.username,
    rating: opponent.rating,
    image: opponent.image,
  };

  await Promise.all([
    playerManager.setUserStatus(player.userId, 'in-game'),
    playerManager.setUserActiveGame(player.userId, gameData.gameId),
    playerManager.setUserStatus(opponent.userId, 'in-game'),
    playerManager.setUserActiveGame(opponent.userId, gameData.gameId),
  ]);

  io.to(getUserRoomId(player.userId)).emit(SOCKET_EVENTS.MATCH_FOUND, {
    gameId: gameData.gameId,
    opponent: player2Data,
    color: player1IsWhite ? 'white' : 'black',
    timeControl: player.timeControl,
    initialTime: initialMinutes * 60,
    incrementTime: incrementSeconds,
  });

  io.to(getUserRoomId(opponent.userId)).emit(SOCKET_EVENTS.MATCH_FOUND, {
    gameId: gameData.gameId,
    opponent: player1Data,
    color: player2IsWhite ? 'white' : 'black',
    timeControl: player.timeControl,
    initialTime: initialMinutes * 60,
    incrementTime: incrementSeconds,
  });

  return true;
}

function startMatchmakingLoop(io: TypedServer, socket: AuthenticatedSocket): void {
  const userId = socket.data.userId;
  let isSearching = true;

  const intervalId = setInterval(async () => {
    if (!isSearching) {
      clearInterval(intervalId);
      return;
    }

    try {
      const queueStatus = await matchmakingService.getQueueStatus(userId);

      if (!queueStatus) {
        // No longer in queue
        clearInterval(intervalId);
        isSearching = false;
        return;
      }

      const matchFound = await tryMatchmaking(io, userId);

      if (matchFound) {
        clearInterval(intervalId);
        isSearching = false;
        return;
      }

      const updatedStatus = await matchmakingService.getQueueStatus(userId);
      if (updatedStatus) {
        socket.emit(SOCKET_EVENTS.QUEUE_STATUS, updatedStatus);
      }
    } catch (error) {
      console.error('[Matchmaking] Loop error:', error);
      clearInterval(intervalId);
      isSearching = false;
    }
  }, 2000);

  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    clearInterval(intervalId);
    isSearching = false;

    await matchmakingService.removeFromQueue(userId);

    const activeGame = await playerManager.getUserActiveGame(userId);
    if (!activeGame) {
      await playerManager.setUserStatus(userId, 'idle');
    }
  });

  socket.on(SOCKET_EVENTS.CANCEL_MATCHMAKING, async () => {
    clearInterval(intervalId);
    isSearching = false;

    const activeGame = await playerManager.getUserActiveGame(userId);
    if (!activeGame) {
      await playerManager.setUserStatus(userId, 'idle');
    }
  });
}

async function handleCancelMatchmaking(socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data.userId;
  const removed = await matchmakingService.removeFromQueue(userId);

  if (removed) {
    console.log(`[Matchmaking] ${socket.data.username} cancelled matchmaking`);

    const activeGame = await playerManager.getUserActiveGame(userId);
    if (!activeGame) {
      await playerManager.setUserStatus(userId, 'idle');
    }

    socket.emit(SOCKET_EVENTS.MATCHMAKING_CANCELLED);
  }
}

export function getQueueStats() {
  return matchmakingService.getQueueStats();
}
