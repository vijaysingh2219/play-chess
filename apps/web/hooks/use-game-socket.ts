'use client';

import { SoundManager } from '@/lib/sound-manager';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import {
  GameEndedPayload,
  GameError,
  GameState,
  GameSyncPayload,
  MakeMovePayload,
  MoveAcceptedPayload,
  OpponentMovedPayload,
} from '@workspace/utils/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './use-socket';

interface UseGameSocketOptions {
  gameId: string;
  onGameEnded?: (payload: GameEndedPayload) => void;
  onDrawOffered?: () => void;
  onBothPlayersReady?: () => void;
}

interface UseGameSocketReturn {
  gameState: GameState | null;
  yourColor: 'w' | 'b' | null;
  canMove: boolean;
  isLoading: boolean;
  error: GameError | null;
  latency: number;
  timeLeft: {
    white: number;
    black: number;
  };
  waitingForOpponent: boolean;
  makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  leaveGame: () => void;
}

export function useGameSocket(options: UseGameSocketOptions): UseGameSocketReturn {
  const { gameId, onGameEnded, onDrawOffered, onBothPlayersReady } = options;
  const { socket, isAuthenticated, latency } = useSocket({ autoConnect: true });

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [yourColor, setYourColor] = useState<'w' | 'b' | null>(null);
  const [canMove, setCanMove] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GameError | null>(null);
  const [timeLeft, setTimeLeft] = useState({ white: 0, black: 0 });
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Track if game is joined to prevent duplicate joins
  const hasJoinedRef = useRef(false);
  const hasMarkedReadyRef = useRef(false);
  const boardReadyRef = useRef(false);

  // Client-side timer for active player's clock
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize sound manager
   */
  useEffect(() => {
    SoundManager.init();
    SoundManager.loadMuteState();

    // Enable audio after user interaction (browser autoplay policy)
    const enableAudio = () => {
      SoundManager.unlockAudio();
      window.removeEventListener('click', enableAudio);
    };

    window.addEventListener('click', enableAudio);
    return () => window.removeEventListener('click', enableAudio);
  }, []);

  /**
   * Join game room
   */
  const joinGame = useCallback(() => {
    if (!socket || !isAuthenticated || hasJoinedRef.current) {
      return;
    }

    console.log('[Game] Joining game:', gameId);
    hasJoinedRef.current = true;

    socket.emit(SOCKET_EVENTS.JOIN_GAME, { gameId });
  }, [socket, isAuthenticated, gameId]);

  /**
   * Mark player as ready (called after board is rendered)
   */
  const markReady = useCallback(() => {
    if (!socket || !gameId || hasMarkedReadyRef.current || !boardReadyRef.current) {
      return;
    }

    console.log('[Game] Marking player as ready');
    hasMarkedReadyRef.current = true;

    socket.emit(SOCKET_EVENTS.PLAYER_READY, { gameId });
  }, [socket, gameId]);

  /**
   * Leave game room
   */
  const leaveGame = useCallback(() => {
    if (!socket) {
      return;
    }

    console.log('[Game] Leaving game:', gameId);
    hasJoinedRef.current = false;
    hasMarkedReadyRef.current = false;

    socket.emit(SOCKET_EVENTS.LEAVE_GAME, { gameId });
  }, [socket, gameId]);

  /**
   * Make a move
   */
  const makeMove = useCallback(
    (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
      if (!socket || !canMove) {
        console.warn('[Game] Cannot make move');
        return;
      }

      const payload: MakeMovePayload = {
        gameId,
        from,
        to,
        promotion,
      };

      socket.emit(SOCKET_EVENTS.MAKE_MOVE, payload);
    },
    [socket, gameId, canMove],
  );

  const resign = useCallback(() => {
    if (!socket) {
      return;
    }

    socket.emit(SOCKET_EVENTS.RESIGN, { gameId });
  }, [socket, gameId]);

  const offerDraw = useCallback(() => {
    if (!socket) {
      return;
    }

    socket.emit(SOCKET_EVENTS.DRAW_OFFER, { gameId });
  }, [socket, gameId]);

  const acceptDraw = useCallback(() => {
    if (!socket) {
      return;
    }

    socket.emit(SOCKET_EVENTS.DRAW_ACCEPT, { gameId });
  }, [socket, gameId]);

  const declineDraw = useCallback(() => {
    if (!socket) {
      return;
    }

    socket.emit(SOCKET_EVENTS.DRAW_DECLINE, { gameId });
  }, [socket, gameId]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!socket) {
      return;
    }

    // Game started (initial sync)
    const handleGameStarted = (payload: GameSyncPayload) => {
      console.log('[Game] Game started:', payload);
      setGameState(payload.game);
      setYourColor(payload.yourColor);
      setCanMove(payload.canMove);

      setTimeLeft({
        white: payload.game.whiteTimeLeft,
        black: payload.game.blackTimeLeft,
      });

      setIsLoading(false);

      // Mark board as ready after first render
      boardReadyRef.current = true;
    };

    const handleWaitingForOpponent = () => {
      setWaitingForOpponent(true);
    };

    // Game sync (reconnection)
    const handleGameSync = (payload: GameSyncPayload) => {
      console.log('[Game] Game synced:', payload);
      setGameState(payload.game);
      setYourColor(payload.yourColor);
      setCanMove(payload.canMove);

      setTimeLeft({
        white: payload.game.whiteTimeLeft,
        black: payload.game.blackTimeLeft,
      });

      setWaitingForOpponent(false);
      setIsLoading(false);

      onBothPlayersReady?.();
    };

    const handleMoveAccepted = (payload: MoveAcceptedPayload) => {
      // Play sound based on move type and game state
      if (payload.gameState.isCheckmate) {
        SoundManager.play('checkmate');
      } else if (payload.gameState.isStalemate || payload.gameState.isDraw) {
        SoundManager.play('gameOver');
      } else if (payload.gameState.isCheck) {
        SoundManager.play('check');
      } else if (payload.move.captured) {
        SoundManager.play('capture');
      } else if (payload.move.san.includes('O-O')) {
        SoundManager.play('castling');
      } else {
        SoundManager.play('move');
      }

      if (gameState) {
        setGameState({
          ...gameState,
          currentFen: payload.gameState.currentFen,
          currentTurn: payload.gameState.currentTurn,
          moves: [...gameState.moves, payload.move],
        });
      }

      setTimeLeft({
        white: payload.gameState.whiteTimeLeft,
        black: payload.gameState.blackTimeLeft,
      });

      setCanMove(false);
    };

    const handleOpponentMoved = (payload: OpponentMovedPayload) => {
      // Play sound based on move type and game state
      if (payload.gameState.isCheckmate) {
        SoundManager.play('checkmate');
      } else if (payload.gameState.isStalemate || payload.gameState.isDraw) {
        SoundManager.play('gameOver');
      } else if (payload.gameState.isCheck) {
        SoundManager.play('check');
      } else if (payload.move.captured) {
        SoundManager.play('capture');
      } else if (payload.move.san.includes('O-O')) {
        SoundManager.play('castling');
      } else {
        SoundManager.play('move');
      }

      if (gameState) {
        setGameState({
          ...gameState,
          currentFen: payload.gameState.currentFen,
          currentTurn: payload.gameState.currentTurn,
          moves: [...gameState.moves, payload.move],
        });
      }

      setTimeLeft({
        white: payload.gameState.whiteTimeLeft,
        black: payload.gameState.blackTimeLeft,
      });

      setCanMove(true);
    };

    const handleGameEnded = (payload: GameEndedPayload) => {
      console.log('[Game] Game ended:', payload);
      setCanMove(false);
      onGameEnded?.(payload);
    };

    const handleDrawOffer = () => {
      console.log('[Game] Draw offered by opponent');
      onDrawOffered?.();
    };

    const handleInvalidMove = (error: GameError) => {
      console.error('[Game] Invalid move:', error);
      setError(error);
    };

    const handleGameError = (error: GameError) => {
      console.error('[Game] Game error:', error);
      setError(error);
      setIsLoading(false);
    };

    // Register listeners
    socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(SOCKET_EVENTS.WAITING_FOR_OPPONENT, handleWaitingForOpponent);
    socket.on(SOCKET_EVENTS.GAME_SYNC, handleGameSync);
    socket.on(SOCKET_EVENTS.MOVE_ACCEPTED, handleMoveAccepted);
    socket.on(SOCKET_EVENTS.OPPONENT_MOVED, handleOpponentMoved);
    socket.on(SOCKET_EVENTS.GAME_ENDED, handleGameEnded);
    socket.on(SOCKET_EVENTS.DRAW_OFFER, handleDrawOffer);
    socket.on(SOCKET_EVENTS.INVALID_MOVE, handleInvalidMove);
    socket.on(SOCKET_EVENTS.GAME_ERROR, handleGameError);

    // Cleanup
    return () => {
      socket.off(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
      socket.off(SOCKET_EVENTS.WAITING_FOR_OPPONENT, handleWaitingForOpponent);
      socket.off(SOCKET_EVENTS.GAME_SYNC, handleGameSync);
      socket.off(SOCKET_EVENTS.MOVE_ACCEPTED, handleMoveAccepted);
      socket.off(SOCKET_EVENTS.OPPONENT_MOVED, handleOpponentMoved);
      socket.off(SOCKET_EVENTS.GAME_ENDED, handleGameEnded);
      socket.off(SOCKET_EVENTS.DRAW_OFFER, handleDrawOffer);
      socket.off(SOCKET_EVENTS.INVALID_MOVE, handleInvalidMove);
      socket.off(SOCKET_EVENTS.GAME_ERROR, handleGameError);
    };
  }, [socket, gameId, gameState, onGameEnded, onDrawOffered, onBothPlayersReady]);

  /**
   * Join game on mount
   */
  useEffect(() => {
    if (isAuthenticated) {
      joinGame();
    }

    return () => {
      leaveGame();
    };
  }, [isAuthenticated, joinGame, leaveGame]);

  /**
   * Mark ready after board is rendered
   * This happens automatically after the first game sync
   */
  useEffect(() => {
    if (boardReadyRef.current && !hasMarkedReadyRef.current) {
      // Small delay to ensure board is fully rendered
      const timer = setTimeout(() => {
        markReady();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [markReady, gameState]);

  /**
   * Update canMove based on current turn and player color
   */
  useEffect(() => {
    if (!gameState || !yourColor) {
      return;
    }

    const isYourTurn = yourColor === gameState.currentTurn;

    setCanMove(isYourTurn && gameState.status === 'ONGOING');
  }, [gameState, yourColor]);

  /**
   * Client-side timer countdown
   *
   * Only count down the ACTIVE player's clock (whose turn it is)
   * This runs locally for smooth display
   * Server time is authoritative and syncs on each move
   */
  useEffect(() => {
    if (!gameState || gameState.status !== 'ONGOING' || waitingForOpponent) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const activeColor = gameState.currentTurn === 'w' ? 'white' : 'black';

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = {
          ...prev,
          [activeColor]: Math.max(0, prev[activeColor] - 100),
        };

        // Check for timeout
        if (newTime[activeColor] <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }

        return newTime;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState?.currentTurn, gameState?.status, waitingForOpponent, gameState]);

  return {
    gameState,
    yourColor,
    canMove,
    isLoading,
    error,
    latency,
    timeLeft,
    waitingForOpponent,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    leaveGame,
  };
}
