import { SOCKET_EVENTS } from '@workspace/utils/constants';
import {
  AuthenticatedSocket,
  getGameRoomId,
  getUserRoomId,
  TypedServer,
} from '@workspace/utils/types';
import { Chess } from 'chess.js';
import { GameError } from '../middleware/error.middleware';
import { createHandler } from '../middleware/validation.middleware';
import {
  GameIdPayload,
  GameIdSchema,
  JoinGamePayload,
  JoinGameSchema,
  MakeMovePayload,
  MakeMoveSchema,
} from '../schemas';
import { gameService } from '../services/game';
import { playerManager } from '../services/player-manager';

export function setupGameHandlers(io: TypedServer): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Join game
    socket.on(
      SOCKET_EVENTS.JOIN_GAME,
      createHandler(socket, JoinGameSchema, (payload) => handleJoinGame(io, socket, payload)),
    );

    // Leave game
    socket.on(
      SOCKET_EVENTS.LEAVE_GAME,
      createHandler(socket, GameIdSchema, (payload) => handleLeaveGame(socket, payload)),
    );

    // Player ready
    socket.on(
      SOCKET_EVENTS.PLAYER_READY,
      createHandler(socket, GameIdSchema, async (payload) => {
        console.log('[Game] Player ready received');
        await handlePlayerReady(io, socket, payload);
      }),
    );

    // Make move
    socket.on(
      SOCKET_EVENTS.MAKE_MOVE,
      createHandler(socket, MakeMoveSchema, (payload) => handleMakeMove(io, socket, payload)),
    );

    // Resign
    socket.on(
      SOCKET_EVENTS.RESIGN,
      createHandler(socket, GameIdSchema, (payload) => handleResign(io, socket, payload)),
    );

    // Draw offer
    socket.on(
      SOCKET_EVENTS.DRAW_OFFER,
      createHandler(socket, GameIdSchema, (payload) => handleDrawOffer(io, socket, payload)),
    );

    // Draw accept
    socket.on(
      SOCKET_EVENTS.DRAW_ACCEPT,
      createHandler(socket, GameIdSchema, (payload) => handleDrawAccept(io, socket, payload)),
    );

    // Draw decline
    socket.on(
      SOCKET_EVENTS.DRAW_DECLINE,
      createHandler(socket, GameIdSchema, (payload) => handleDrawDecline(io, socket, payload)),
    );

    // Abort game
    socket.on(
      SOCKET_EVENTS.ABORT,
      createHandler(socket, GameIdSchema, (payload) => handleAbort(io, socket, payload)),
    );
  });
}

async function handleJoinGame(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: JoinGamePayload,
): Promise<void> {
  const { gameId } = payload;
  const userId = socket.data.userId;

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  const isPlayer = userId === gameState.whitePlayerId || userId === gameState.blackPlayerId;

  if (!isPlayer) {
    throw new GameError('You are not a player in this game', gameId);
  }

  const roomId = getGameRoomId(gameId);
  socket.join(roomId);

  await playerManager.setUserActiveGame(userId, gameId);
  await playerManager.setUserStatus(userId, 'in-game');

  console.log(`[Game] ${socket.data.username} joined game ${gameId}`);

  const isWhite = userId === gameState.whitePlayerId;
  const yourColor = isWhite ? 'w' : 'b';
  const canMove = gameState.currentTurn === (isWhite ? 'w' : 'b');

  socket.emit(SOCKET_EVENTS.GAME_STARTED, {
    game: gameState,
    yourColor,
    canMove,
  });
}

async function handleLeaveGame(socket: AuthenticatedSocket, payload: GameIdPayload): Promise<void> {
  const { gameId } = payload;
  const roomId = getGameRoomId(gameId);

  socket.leave(roomId);

  console.log(`[Game] ${socket.data.username} left game ${gameId}`);
}

async function handlePlayerReady(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;
  const userId = socket.data.userId;

  const result = await gameService.markPlayerReady(gameId, userId);

  console.log(`[Game] ${socket.data.username} is ready in game ${gameId}`);

  // When both players are ready, emit GAME_SYNC so clients start their clocks
  if (result.bothReady) {
    // Load game WITHOUT elapsed-time calculation since clocks just started
    const gameState = await gameService.loadGame(gameId, false);
    if (gameState) {
      const whitePlayerId = gameState.whitePlayerId;
      const blackPlayerId = gameState.blackPlayerId;

      io.to(getUserRoomId(whitePlayerId)).emit(SOCKET_EVENTS.GAME_SYNC, {
        game: gameState,
        yourColor: 'w',
        canMove: gameState.currentTurn === 'w',
      });

      io.to(getUserRoomId(blackPlayerId)).emit(SOCKET_EVENTS.GAME_SYNC, {
        game: gameState,
        yourColor: 'b',
        canMove: gameState.currentTurn === 'b',
      });

      console.log(`[Game] Both players ready, GAME_SYNC emitted for game ${gameId}`);
    }
  }
}

async function handleMakeMove(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: MakeMovePayload,
): Promise<void> {
  const { gameId, from, to, promotion } = payload;
  const userId = socket.data.userId;

  const { moveData, gameState, gameEndInfo } = await gameService.makeMove(
    gameId,
    userId,
    from,
    to,
    promotion,
  );

  const chess = new Chess(gameState.currentFen);

  const moveResponse = {
    move: moveData,
    gameState: {
      currentFen: gameState.currentFen,
      currentTurn: gameState.currentTurn,
      whiteTimeLeft: gameState.whiteTimeLeft,
      blackTimeLeft: gameState.blackTimeLeft,
      moveNumber: moveData.moveNumber,
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
    },
  };

  console.log('[Game] Move processed:', moveResponse);

  socket.emit(SOCKET_EVENTS.MOVE_ACCEPTED, moveResponse);

  const roomId = getGameRoomId(gameId);
  socket.to(roomId).emit(SOCKET_EVENTS.OPPONENT_MOVED, moveResponse);

  console.log(`[Game] ${socket.data.username} moved ${moveData.san} in game ${gameId}`);

  // If the game ended due to checkmate/stalemate/draw, emit GAME_ENDED
  if (gameEndInfo) {
    await playerManager.removeUserActiveGame(gameState.whitePlayerId);
    await playerManager.removeUserActiveGame(gameState.blackPlayerId);
    await playerManager.setUserStatus(gameState.whitePlayerId, 'idle');
    await playerManager.setUserStatus(gameState.blackPlayerId, 'idle');

    io.in(roomId).emit(SOCKET_EVENTS.GAME_ENDED, {
      gameId,
      winner: gameEndInfo.winner,
      reason: gameEndInfo.reason,
      finalFen: gameState.currentFen,
      eloChanges: {
        white: gameEndInfo.ratings.whiteChange,
        black: gameEndInfo.ratings.blackChange,
      },
      newRatings: {
        white: gameEndInfo.ratings.whiteNewRating,
        black: gameEndInfo.ratings.blackNewRating,
      },
      pgn: '',
    });

    console.log(`[Game] Game ${gameId} ended: ${gameEndInfo.winner} by ${gameEndInfo.reason}`);
  }
}

async function handleResign(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;
  const userId = socket.data.userId;

  const ratings = await gameService.resignGame(gameId, userId);

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  await playerManager.removeUserActiveGame(gameState.whitePlayerId);
  await playerManager.removeUserActiveGame(gameState.blackPlayerId);
  await playerManager.setUserStatus(gameState.whitePlayerId, 'idle');
  await playerManager.setUserStatus(gameState.blackPlayerId, 'idle');

  const roomId = getGameRoomId(gameId);
  io.in(roomId).emit(SOCKET_EVENTS.GAME_ENDED, {
    gameId,
    winner:
      gameState.status === 'COMPLETED'
        ? userId === gameState.whitePlayerId
          ? 'BLACK'
          : 'WHITE'
        : 'DRAW',
    reason: 'RESIGNATION',
    finalFen: gameState.currentFen,
    eloChanges: {
      white: ratings.ratings.whiteChange,
      black: ratings.ratings.blackChange,
    },
    newRatings: {
      white: ratings.ratings.whiteNewRating,
      black: ratings.ratings.blackNewRating,
    },
    pgn: '', // Will be populated from DB
  });

  console.log(`[Game] ${socket.data.username} resigned game ${gameId}`);
}

async function handleDrawOffer(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;
  const userId = socket.data.userId;

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  const isPlayer = userId === gameState.whitePlayerId || userId === gameState.blackPlayerId;

  if (!isPlayer) {
    throw new GameError('You are not a player in this game', gameId);
  }

  const opponentId =
    userId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;

  io.to(getUserRoomId(opponentId)).emit(SOCKET_EVENTS.DRAW_OFFER);

  console.log(`[Game] ${socket.data.username} offered draw in game ${gameId}`);
}

async function handleDrawAccept(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;

  const ratings = await gameService.acceptDraw(gameId);

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  await playerManager.removeUserActiveGame(gameState.whitePlayerId);
  await playerManager.removeUserActiveGame(gameState.blackPlayerId);
  await playerManager.setUserStatus(gameState.whitePlayerId, 'idle');
  await playerManager.setUserStatus(gameState.blackPlayerId, 'idle');

  const roomId = getGameRoomId(gameId);
  io.in(roomId).emit(SOCKET_EVENTS.GAME_ENDED, {
    gameId,
    winner: 'DRAW',
    reason: 'AGREEMENT',
    finalFen: gameState.currentFen,
    eloChanges: {
      white: ratings.ratings.whiteChange,
      black: ratings.ratings.blackChange,
    },
    newRatings: {
      white: ratings.ratings.whiteNewRating,
      black: ratings.ratings.blackNewRating,
    },
    pgn: '',
  });

  console.log(`[Game] Draw accepted in game ${gameId}`);
}

async function handleDrawDecline(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;
  const userId = socket.data.userId;

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  const opponentId =
    userId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;

  io.to(getUserRoomId(opponentId)).emit(SOCKET_EVENTS.DRAW_DECLINED);

  console.log(`[Game] ${socket.data.username} declined draw in game ${gameId}`);
}

async function handleAbort(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: GameIdPayload,
): Promise<void> {
  const { gameId } = payload;

  const gameState = await gameService.loadGame(gameId);

  if (!gameState) {
    throw new GameError('Game not found', gameId);
  }

  if (gameState.moves.length >= 2) {
    throw new GameError('Game cannot be aborted after 2 moves have been made', gameId);
  }

  await gameService.abortGame(gameId);

  console.log(`[Game] Game ${gameId} aborted`);
}
