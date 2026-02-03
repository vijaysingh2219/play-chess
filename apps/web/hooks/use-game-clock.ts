import type { Color } from 'chess.js';
import { useEffect, useRef, useState } from 'react';

interface UseGameClockParams {
  /** Time left for each player from the server */
  timeLeft: { white: number; black: number };
  /** Current turn (who's clock should be running) */
  currentTurn?: Color | null;
  /** Whether the game is currently active */
  isGameActive: boolean;
  /** Update interval in milliseconds */
  updateInterval?: number;
}

/**
 * Custom hook to manage the running game clock
 * Handles the countdown logic for both players' clocks
 */
export function useGameClock({
  timeLeft,
  currentTurn,
  isGameActive,
  updateInterval = 100,
}: UseGameClockParams): {
  white: number;
  black: number;
} {
  const [displayTime, setDisplayTime] = useState({
    white: timeLeft.white,
    black: timeLeft.black,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync display time with server time when it changes (e.g., after a move)
  useEffect(() => {
    setDisplayTime({
      white: timeLeft.white,
      black: timeLeft.black,
    });
  }, [timeLeft]);

  // Run the clock for the active player
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't run clock if game is not active or no current turn
    if (!isGameActive || !currentTurn) {
      return;
    }

    // Start the countdown interval
    intervalRef.current = setInterval(() => {
      setDisplayTime((prev) => {
        const elapsed = updateInterval;

        if (currentTurn === 'w' && prev.white > 0) {
          return {
            white: Math.max(0, prev.white - elapsed),
            black: prev.black,
          };
        } else if (currentTurn === 'b' && prev.black > 0) {
          return {
            white: prev.white,
            black: Math.max(0, prev.black - elapsed),
          };
        }

        return prev;
      });
    }, updateInterval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentTurn, isGameActive, updateInterval]);

  return displayTime;
}
