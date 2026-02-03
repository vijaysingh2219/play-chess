import type { GameTerminationReason } from '../types/chess';

export const getTimeControlParts = (timeControl: string): { timer: number; increment: number } => {
  const [timerStr, incrementStr] = timeControl.split('+');
  const timer = parseInt(timerStr || '', 10);
  const increment = incrementStr ? parseInt(incrementStr || '', 10) : 0;
  return { timer, increment };
};

/**
 * Format a game termination reason for display.
 * @param reason - The termination reason enum value
 */
export const formatReason = (reason: GameTerminationReason): string => {
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
};
