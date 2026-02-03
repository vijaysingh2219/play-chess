import { AuthUser } from '@/hooks/use-auth-user';
import { DisplayUser } from '@/types';
import { GameState } from '@workspace/utils';
import type { Color } from 'chess.js';
import { useMemo } from 'react';

export interface PlayerPosition {
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    image: string | null;
    rating?: number | null;
    createdAt?: Date | null;
  };
  time: number;
  lowTime: boolean;
  isTurn: boolean;
  capturedPieces?: { w: string[]; b: string[] };
  color: 'w' | 'b';
  gameState?: GameState;
  showCapturedPieces?: boolean;
}

interface UsePlayerPositionsParams {
  gameState: GameState | null;
  user: AuthUser | DisplayUser | null;
  displayTime: { white: number; black: number };
  boardOrientation: 'white' | 'black';
  isPlayersTurn: () => boolean;
  lowTimeThreshold?: number;
}

/**
 * Custom hook to manage player positions (top/bottom) based on board orientation
 * Consolidates logic from OnlineGame and NewOnlineGame
 */
export function usePlayerPositions({
  gameState,
  user,
  displayTime,
  boardOrientation,
  isPlayersTurn,
  lowTimeThreshold = 20000,
}: UsePlayerPositionsParams): {
  top: PlayerPosition;
  bottom: PlayerPosition;
} {
  console.log('usePlayerPositions called with:', user);
  return useMemo(() => {
    const isLowTime = (time: number) => time < lowTimeThreshold;
    // Default positions for when there's no game state (e.g., matchmaking)
    if (!gameState) {
      return {
        top: {
          user: { id: '', name: '', username: '', image: null, rating: null, createdAt: null },
          time: 0,
          lowTime: false,
          isTurn: false,
          capturedPieces: { w: [], b: [] },
          color: 'w' as 'w' | 'b',
        },
        bottom: {
          user: {
            id: user?.id || '123',
            name: user?.name || null,
            username: user?.username || '',
            image: user?.image || null,
            rating: user?.rating || null,
            createdAt: user?.createdAt || null,
          },
          time: 0,
          lowTime: false,
          isTurn: false,
          capturedPieces: { w: [], b: [] },
          color: 'b' as 'w' | 'b',
        },
      };
    }

    // Determine player colors
    const myColor: Color = gameState.whitePlayerId === user?.id ? 'w' : 'b';
    const oppColor: Color = myColor === 'w' ? 'b' : 'w';

    // Build player props
    const myProps: PlayerPosition = {
      gameState,
      user: myColor === 'w' ? gameState.whitePlayer : gameState.blackPlayer,
      time: displayTime[myColor === 'w' ? 'white' : 'black'] || 0,
      lowTime: isLowTime(displayTime[myColor === 'w' ? 'white' : 'black']),
      isTurn: isPlayersTurn(),
      color: myColor,
      showCapturedPieces: true,
    };

    const opponentProps: PlayerPosition = {
      gameState,
      user: oppColor === 'w' ? gameState.whitePlayer : gameState.blackPlayer,
      time: displayTime[oppColor === 'w' ? 'white' : 'black'] || 0,
      lowTime: isLowTime(displayTime[oppColor === 'w' ? 'white' : 'black']),
      isTurn: !isPlayersTurn(),
      color: oppColor,
      showCapturedPieces: true,
    };

    // Determine which player is at the bottom based on board orientation
    const bottomColor = boardOrientation === 'white' ? 'w' : 'b';

    if (myColor === bottomColor) {
      return { top: opponentProps, bottom: myProps };
    } else {
      return { top: myProps, bottom: opponentProps };
    }
  }, [gameState, isPlayersTurn, user, displayTime, boardOrientation, lowTimeThreshold]);
}
