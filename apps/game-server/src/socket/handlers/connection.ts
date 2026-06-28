import {
  AuthenticatedSocket,
  getGameRoomId,
  getUserRoomId,
  TypedServer,
} from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { createHandler } from '../middleware/validation.middleware';
import { PingCheckSchema } from '../schemas';
import { gameService } from '../services/game';
import { matchmakingService } from '../services/matchmaking';
import { playerManager } from '../services/player-manager';

export function setupConnectionHandlers(io: TypedServer): void {
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    socket.data.log.info('connected');

    // Register socket with PlayerManager
    await playerManager.addSocket(userId, socket.id);

    // Join user's personal room for direct messages
    socket.join(getUserRoomId(userId));

    // Send authentication confirmation
    socket.emit(SOCKET_EVENTS.USER_AUTHENTICATED, {
      userId,
      username,
      rating: socket.data.rating,
    });

    // Check for active games and rejoin
    await handleReconnection(socket);

    // Setup ping-pong for latency measurement
    setupPingHandler(socket);

    // Handle disconnection
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      await handleDisconnect(socket);
    });
  });
}

async function handleReconnection(socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data.userId;

  try {
    // Find any active games for this user
    const activeGames = await prisma.game.findMany({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
        status: 'ONGOING',
      },
      include: {
        whitePlayer: {
          select: { id: true, username: true, rating: true },
        },
        blackPlayer: {
          select: { id: true, username: true, rating: true },
        },
      },
    });

    for (const game of activeGames) {
      // Join game room
      const roomId = getGameRoomId(game.id);
      socket.join(roomId);

      // Notify client about active game
      socket.emit(SOCKET_EVENTS.ACTIVE_GAME_FOUND, {
        gameId: game.id,
        status: game.status,
      });

      // Load and sync game state
      const gameState = await gameService.loadGame(game.id);
      if (gameState) {
        const isWhite = userId === game.whitePlayerId;

        socket.emit(SOCKET_EVENTS.GAME_SYNC, {
          game: gameState,
          yourColor: isWhite ? 'w' : 'b',
          canMove: gameState.currentTurn === (isWhite ? 'w' : 'b'),
        });

        socket.data.log.info({ gameId: game.id }, 'reconnected to game');
      }

      // Update socket ID in game cache if it exists
      const cache = await gameService.getGameCache(game.id);
      if (cache) {
        if (userId === game.whitePlayerId) {
          cache.whiteSocketId = socket.id;
        } else {
          cache.blackSocketId = socket.id;
        }
      }
    }
  } catch (error) {
    socket.data.log.error({ err: error }, 'reconnection failed');
  }
}

async function handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data.userId;

  socket.data.log.info('disconnected');

  try {
    // Remove socket from PlayerManager
    await playerManager.removeSocket(userId, socket.id);

    // Remove from matchmaking queue
    matchmakingService.removeFromQueue(userId);

    // Update last seen timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    socket.data.log.error({ err: error }, 'disconnect handling failed');
  }
}

function setupPingHandler(socket: AuthenticatedSocket): void {
  socket.on(
    SOCKET_EVENTS.PING_CHECK,
    createHandler(socket, PingCheckSchema, async (payload) => {
      const now = Date.now();
      const latency = now - payload.timestamp;

      socket.emit(SOCKET_EVENTS.PONG_RESPONSE, {
        timestamp: now,
        latency,
      });

      // Update last ping time
      socket.data.lastPingAt = new Date();
    }),
  );
}
