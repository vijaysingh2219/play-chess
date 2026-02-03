/**
 * Game State Service
 *
 * Builds and manages game state from various sources:
 * - Database records
 * - Redis cache
 * - Chess.js instances
 */

import { prisma } from '@workspace/db';
import { ActiveGameCache, GameState, MoveData } from '@workspace/utils/types';
import { Chess, PieceSymbol } from 'chess.js';

/**
 * Build game state from database record
 */
export function buildGameStateFromDB(game: {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePlayer: GameState['whitePlayer'];
  blackPlayer: GameState['blackPlayer'];
  status: GameState['status'];
  currentFen?: string;
  moves: MoveData[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  timeControl: string;
  initialTime: number;
  incrementTime: number;
  startedAt: Date;
}): GameState {
  const chess = new Chess();

  if (game.moves && game.moves.length > 0) {
    for (const move of game.moves) {
      chess.move(move.san);
    }
  }

  let lastMoveAt: number | undefined = undefined;
  if (game.moves && game.moves.length > 0) {
    const lastMove = game.moves[game.moves.length - 1];
    if (lastMove && lastMove.createdAt) {
      lastMoveAt = new Date(lastMove.createdAt).getTime();
    }
  }

  return {
    id: game.id,
    whitePlayerId: game.whitePlayerId,
    blackPlayerId: game.blackPlayerId,
    whitePlayer: game.whitePlayer,
    blackPlayer: game.blackPlayer,
    status: game.status,
    currentFen: chess.fen(),
    moves: game.moves,
    whiteTimeLeft: game.whiteTimeLeft,
    blackTimeLeft: game.blackTimeLeft,
    currentTurn: chess.turn(),
    timeControl: game.timeControl,
    initialTime: game.initialTime,
    incrementTime: game.incrementTime,
    startedAt: game.startedAt.getTime(),
    lastMoveAt,
  };
}

/**
 * Build game state from cache with calculated time values
 */
export async function buildGameStateFromCache(
  cache: ActiveGameCache,
  whiteTimeLeft: number,
  blackTimeLeft: number,
): Promise<GameState | null> {
  const game = await prisma.game.findUnique({
    where: { id: cache.gameId },
    include: {
      whitePlayer: {
        select: { id: true, username: true, name: true, image: true, rating: true },
      },
      blackPlayer: {
        select: { id: true, username: true, name: true, image: true, rating: true },
      },
      moves: {
        orderBy: { moveNumber: 'asc' },
      },
    },
  });

  if (!game) return null;

  const lastMoveTime =
    typeof cache.lastMoveAt === 'string' ? new Date(cache.lastMoveAt).getTime() : cache.lastMoveAt;

  return {
    id: cache.gameId,
    whitePlayerId: cache.whitePlayerId,
    blackPlayerId: cache.blackPlayerId,
    whitePlayer: game.whitePlayer,
    blackPlayer: game.blackPlayer,
    status: cache.status,
    currentFen: cache.currentFen,
    moves: game.moves?.map((move) => ({
      ...move,
      captured: move.captured as PieceSymbol | null,
      promotion: move.promotion as PieceSymbol | null,
      createdAt: new Date(move.createdAt),
    })),
    whiteTimeLeft,
    blackTimeLeft,
    currentTurn: cache.currentTurn,
    timeControl: game.timeControl,
    initialTime: game.initialTime,
    incrementTime: game.incrementTime,
    startedAt: game.startedAt.getTime(),
    lastMoveAt: lastMoveTime,
  };
}

/**
 * Load game from database with all relations
 */
export async function loadGameFromDatabase(gameId: string) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: {
      whitePlayer: {
        select: { id: true, username: true, name: true, image: true, rating: true },
      },
      blackPlayer: {
        select: { id: true, username: true, name: true, image: true, rating: true },
      },
      moves: {
        orderBy: { moveNumber: 'asc' },
      },
    },
  });
}

/**
 * Calculate current time left for a player based on elapsed time
 */
export function calculateCurrentTimeLeft(cache: ActiveGameCache): {
  whiteTimeLeft: number;
  blackTimeLeft: number;
} {
  const now = Date.now();
  const lastMoveTime =
    typeof cache.lastMoveAt === 'string' ? new Date(cache.lastMoveAt).getTime() : cache.lastMoveAt;
  const elapsed = now - lastMoveTime;

  const whiteTimeLeft =
    cache.currentTurn === 'w' ? Math.max(0, cache.whiteTimeLeft - elapsed) : cache.whiteTimeLeft;

  const blackTimeLeft =
    cache.currentTurn === 'b' ? Math.max(0, cache.blackTimeLeft - elapsed) : cache.blackTimeLeft;

  return { whiteTimeLeft, blackTimeLeft };
}
