import { SoundManager } from '@/lib/sound-manager';
import { MoveData, STARTING_FEN } from '@workspace/utils';
import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReplayControlsParams {
  /** List of moves in the game */
  moves: MoveData[];
  /** Initial time for each player in milliseconds */
  initialTime?: number;
  /** Increment time per move in milliseconds */
  incrementTime?: number;
  /** Auto-play interval in milliseconds */
  playInterval?: number;
}

interface ReplayControls {
  /** Current move index (-1 = starting position) */
  currentMoveIndex: number;
  /** Current FEN position */
  fen: string;
  /** Whether auto-play is active */
  isPlaying: boolean;
  /** Navigate to specific move */
  goToMove: (index: number) => void;
  /** Go to next move */
  next: () => void;
  /** Go to previous move */
  prev: () => void;
  /** Reset to starting position */
  reset: () => void;
  /** Go to end of game */
  end: () => void;
  /** Toggle auto-play */
  togglePlay: () => void;
  /** Calculate time remaining for a player at current move */
  getTimeAtMove: (player: 'white' | 'black') => number;
  /** Get whose turn it is at current move */
  getCurrentTurn: () => 'w' | 'b';
}

/**
 * Custom hook to manage chess game replay functionality
 * Handles navigation through moves, auto-play, and time calculation
 */
export function useReplayControls({
  moves,
  initialTime = 0,
  incrementTime = 0,
  playInterval = 500,
}: UseReplayControlsParams): ReplayControls {
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [fen, setFen] = useState<string>(STARTING_FEN);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentMoveIndexRef = useRef<number>(-1);

  const playMoveSound = useCallback((move: MoveData) => {
    // Create a chess instance to check game state after the move
    const chess = new Chess(move.fenAfter);

    if (chess.isCheckmate()) {
      SoundManager.play('checkmate');
    } else if (chess.isStalemate() || chess.isDraw()) {
      SoundManager.play('gameOver');
    } else if (chess.isCheck()) {
      SoundManager.play('check');
    } else if (move.captured) {
      SoundManager.play('capture');
    } else if (move.san.includes('O-O')) {
      SoundManager.play('castling');
    } else {
      SoundManager.play('move');
    }
  }, []);

  const goToMove = useCallback(
    (index: number, shouldPlaySound = true) => {
      const safeIndex = Math.max(-1, Math.min(index, moves.length - 1));
      const previousIndex = currentMoveIndexRef.current;

      // Update both state and ref
      setCurrentMoveIndex(safeIndex);
      currentMoveIndexRef.current = safeIndex;

      if (safeIndex === -1) {
        setFen(STARTING_FEN);
      } else {
        setFen(moves[safeIndex]?.fenAfter ?? STARTING_FEN);

        // Play sound for forward navigation (next move)
        if (shouldPlaySound && safeIndex > previousIndex && moves[safeIndex]) {
          playMoveSound(moves[safeIndex]);
        }
      }
    },
    [moves, playMoveSound],
  );

  /**
   * Navigation controls
   */
  const next = useCallback(() => goToMove(currentMoveIndex + 1), [currentMoveIndex, goToMove]);
  const prev = useCallback(() => goToMove(currentMoveIndex - 1), [currentMoveIndex, goToMove]);
  const reset = useCallback(() => goToMove(-1, false), [goToMove]);
  const end = useCallback(() => goToMove(moves.length - 1, false), [moves.length, goToMove]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  /**
   * Reset to start when moves are loaded
   */
  useEffect(() => {
    if (moves.length > 0) {
      goToMove(-1, false);
    }
  }, [moves, goToMove]);

  /**
   * Auto-play effect
   */
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentMoveIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex < moves.length) {
            const move = moves[nextIndex];
            setFen(move?.fenAfter ?? STARTING_FEN);

            // Update the ref
            currentMoveIndexRef.current = nextIndex;

            // Play sound for the move
            if (move) {
              playMoveSound(move);
            }

            return nextIndex;
          } else {
            setIsPlaying(false);
            return prevIndex;
          }
        });
      }, playInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, moves, playInterval, playMoveSound]);

  /**
   * Calculate time remaining for a player at the current move
   */
  const getTimeAtMove = useCallback(
    (player: 'white' | 'black'): number => {
      if (!initialTime || !moves.length) return initialTime;

      let timeRemaining = initialTime;

      // Calculate time for moves up to current index
      for (let i = 0; i <= currentMoveIndex; i++) {
        const move = moves[i];
        if (!move) continue;

        // Check if this move was made by the specified player
        const isWhiteMove = i % 2 === 0;
        const isPlayerMove =
          (player === 'white' && isWhiteMove) || (player === 'black' && !isWhiteMove);

        if (isPlayerMove && move.timeSpent) {
          timeRemaining -= move.timeSpent;
          // Add increment if available
          if (incrementTime) {
            timeRemaining += incrementTime;
          }
        }
      }

      return Math.max(0, timeRemaining);
    },
    [initialTime, moves, currentMoveIndex, incrementTime],
  );

  /**
   * Get whose turn it is at the current move
   */
  const getCurrentTurn = useCallback((): 'w' | 'b' => {
    if (currentMoveIndex === -1) return 'w';
    const lastMove = moves[currentMoveIndex];
    return lastMove?.color === 'w' ? 'b' : 'w';
  }, [currentMoveIndex, moves]);

  return {
    currentMoveIndex,
    fen,
    isPlaying,
    goToMove,
    next,
    prev,
    reset,
    end,
    togglePlay,
    getTimeAtMove,
    getCurrentTurn,
  };
}
