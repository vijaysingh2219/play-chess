/**
 * useMoveNavigation Hook
 *
 * Manages move navigation state and logic for stepping through game history.
 * Used by both online games and replay boards.
 */

import type { MoveData } from '@workspace/utils/types';
import { Chess } from 'chess.js';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseMoveNavigationOptions {
  /** List of moves in the game */
  moves: MoveData[];
  /** Current FEN position (live position for online games) */
  currentFen?: string;
}

interface UseMoveNavigationReturn {
  /** Current index being viewed (-1 for starting position, null for live) */
  viewingMoveIndex: number | null;
  /** Whether the user is viewing history */
  isViewingHistory: boolean;
  /** Computed current view index (always a number) */
  currentViewIndex: number;
  /** Total number of moves */
  totalMoves: number;
  /** FEN for the currently viewed position */
  viewingFen: string;
  /** Navigate to a specific move index */
  goToMove: (index: number) => void;
  /** Navigate to previous move */
  goToPrevMove: () => void;
  /** Navigate to next move */
  goToNextMove: () => void;
  /** Navigate to first move (starting position) */
  goToFirstMove: () => void;
  /** Navigate to latest move (live position) */
  goToLatestMove: () => void;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function useMoveNavigation({
  moves,
  currentFen,
}: UseMoveNavigationOptions): UseMoveNavigationReturn {
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null);

  const totalMoves = moves.length;
  const isViewingHistory = viewingMoveIndex !== null;
  const currentViewIndex = isViewingHistory ? viewingMoveIndex : totalMoves - 1;

  // Calculate FEN for the current viewing position
  const viewingFen = useMemo(() => {
    if (!isViewingHistory) {
      return currentFen || STARTING_FEN;
    }

    if (viewingMoveIndex === -1) {
      return STARTING_FEN;
    }

    const chess = new Chess();
    for (let i = 0; i <= viewingMoveIndex; i++) {
      const move = moves[i];
      if (move) {
        chess.move({
          from: move.from,
          to: move.to,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        });
      }
    }
    return chess.fen();
  }, [isViewingHistory, viewingMoveIndex, moves, currentFen]);

  // Navigate to a specific move index
  const goToMove = useCallback(
    (index: number) => {
      if (index < -1 || index >= totalMoves) return;
      setViewingMoveIndex(index === totalMoves - 1 ? null : index);
    },
    [totalMoves],
  );

  // Navigate to previous move
  const goToPrevMove = useCallback(() => {
    const targetIndex = currentViewIndex - 1;
    if (targetIndex < -1) return;
    setViewingMoveIndex(targetIndex === totalMoves - 1 ? null : targetIndex);
  }, [currentViewIndex, totalMoves]);

  // Navigate to next move
  const goToNextMove = useCallback(() => {
    const targetIndex = currentViewIndex + 1;
    if (targetIndex >= totalMoves) return;
    setViewingMoveIndex(targetIndex === totalMoves - 1 ? null : targetIndex);
  }, [currentViewIndex, totalMoves]);

  // Navigate to first move (starting position)
  const goToFirstMove = useCallback(() => {
    setViewingMoveIndex(-1);
  }, []);

  // Navigate to latest move (live position)
  const goToLatestMove = useCallback(() => {
    setViewingMoveIndex(null);
  }, []);

  // Reset to latest position when new moves come in
  useEffect(() => {
    if (isViewingHistory && viewingMoveIndex >= totalMoves) {
      setViewingMoveIndex(null);
    }
  }, [totalMoves, isViewingHistory, viewingMoveIndex]);

  return {
    viewingMoveIndex,
    isViewingHistory,
    currentViewIndex,
    totalMoves,
    viewingFen,
    goToMove,
    goToPrevMove,
    goToNextMove,
    goToFirstMove,
    goToLatestMove,
  };
}
