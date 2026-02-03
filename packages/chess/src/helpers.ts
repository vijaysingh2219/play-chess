/**
 * Chess helper functions
 *
 * Utility functions for chess game logic like material calculation,
 * piece naming, and game state formatting.
 */

import type { CapturedPieceSymbol, GameTerminationReason, PIECE_VALUES } from './types';

/**
 * Calculate material value of captured pieces
 */
export function calculateMaterialValue(
  pieces: CapturedPieceSymbol[],
  pieceValues: typeof PIECE_VALUES,
): number {
  return pieces.reduce((total, piece) => {
    return total + (pieceValues[piece as keyof typeof pieceValues] ?? 0);
  }, 0);
}

/**
 * Get human-readable piece name from symbol
 */
export function pieceName(piece: CapturedPieceSymbol): string {
  const typeMap: Record<CapturedPieceSymbol, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  };
  return typeMap[piece];
}

/**
 * Format a game termination reason for display
 */
export function formatTerminationReason(reason: GameTerminationReason): string {
  const map: Record<GameTerminationReason, string> = {
    CHECKMATE: 'checkmate',
    STALEMATE: 'stalemate',
    TIMEOUT: 'timeout',
    RESIGNATION: 'resignation',
    AGREEMENT: 'draw by agreement',
    INSUFFICIENT_MATERIAL: 'insufficient material',
    THREEFOLD_REPETITION: 'threefold repetition',
    FIFTY_MOVE_RULE: 'fifty-move rule',
    DISCONNECTION: 'opponent disconnection',
  };

  return map[reason] ?? reason.toLowerCase();
}

/**
 * Determine if a move is a promotion move
 */
export function isPromotionMove(
  piece: string,
  pieceColor: 'w' | 'b',
  targetSquare: string,
): boolean {
  if (piece !== 'p') return false;
  const targetRank = targetSquare[1];
  return (pieceColor === 'w' && targetRank === '8') || (pieceColor === 'b' && targetRank === '1');
}

/**
 * Get the opposite color
 */
export function getOppositeColor(color: 'w' | 'b'): 'w' | 'b' {
  return color === 'w' ? 'b' : 'w';
}
