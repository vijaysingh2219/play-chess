/**
 * Game Persistence Service
 *
 * Handles database operations for games including:
 * - Saving moves
 * - Updating game times
 * - Updating game status
 */

import { GameTerminationReason, prisma, Winner } from '@workspace/db';
import { MoveData } from '@workspace/utils/types';

/**
 * Save a move to the database
 */
export async function saveMoveToDatabase(gameId: string, moveData: MoveData): Promise<void> {
  await prisma.move.create({
    data: {
      gameId,
      moveNumber: moveData.moveNumber,
      color: moveData.color,
      from: moveData.from,
      to: moveData.to,
      piece: moveData.piece,
      captured: moveData.captured,
      promotion: moveData.promotion,
      san: moveData.san,
      lan: moveData.lan,
      fenBefore: moveData.fenBefore,
      fenAfter: moveData.fenAfter,
      timeSpent: moveData.timeSpent,
      timeLeft: moveData.timeLeft,
    },
  });
}

/**
 * Update game times in database
 */
export async function updateGameTimes(
  gameId: string,
  whiteTimeLeft: number,
  blackTimeLeft: number,
): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      whiteTimeLeft,
      blackTimeLeft,
    },
  });
}

/**
 * Update game start time
 */
export async function updateGameStartTime(gameId: string, startedAt: Date): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: { startedAt },
  });
}

/**
 * Complete a game with final state
 */
export async function completeGame(
  gameId: string,
  data: {
    winner: Winner;
    reason: GameTerminationReason;
    finalFen: string;
    pgn: string;
    eloChangeWhite: number;
    eloChangeBlack: number;
    totalMoves: number;
    durationSeconds: number;
  },
): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: 'COMPLETED',
      winner: data.winner,
      reason: data.reason,
      finalFen: data.finalFen,
      pgn: data.pgn,
      eloChangeWhite: data.eloChangeWhite,
      eloChangeBlack: data.eloChangeBlack,
      endedAt: new Date(),
      totalMoves: data.totalMoves,
      durationSeconds: data.durationSeconds,
    },
  });
}

/**
 * Abort a game
 */
export async function abortGame(gameId: string): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: 'ABORTED',
      endedAt: new Date(),
    },
  });
}

/**
 * Update player rating
 */
export async function updatePlayerRating(userId: string, newRating: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { rating: newRating },
  });
}

/**
 * Update both players' ratings
 */
export async function updateBothPlayerRatings(
  whitePlayerId: string,
  blackPlayerId: string,
  whiteNewRating: number,
  blackNewRating: number,
): Promise<void> {
  await Promise.all([
    updatePlayerRating(whitePlayerId, whiteNewRating),
    updatePlayerRating(blackPlayerId, blackNewRating),
  ]);
}
