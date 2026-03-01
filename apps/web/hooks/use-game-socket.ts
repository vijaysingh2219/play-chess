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
  drawOffered: boolean;
  waitingForOpponent: boolean;
  makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  leaveGame: () => void;
}

export function useGameSocket(options: UseGameSocketOptions): UseGameSocketReturn {
  const { gameId, onGameEnded, onBothPlayersReady } = options;
  const { socket, isAuthenticated, latency } = useSocket({ autoConnect: true });

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [yourColor, setYourColor] = useState<'w' | 'b' | null>(null);
  const [canMove, setCanMove] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GameError | null>(null);
  const [timeLeft, setTimeLeft] = useState({ white: 0, black: 0 });
  const [drawOffered, setDrawOffered] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Track if game is joined to prevent duplicate joins
  const hasJoinedRef = useRef(false);
  const hasMarkedReadyRef = useRef(false);
  const boardReadyRef = useRef(false);

  // Refs for callbacks to avoid stale closures and constant re-registration
  const onGameEndedRef = useRef(onGameEnded);
  const onBothPlayersReadyRef = useRef(onBothPlayersReady);

  // Keep callback refs up to date
  useEffect(() => {
    onGameEndedRef.current = onGameEnded;
  }, [onGameEnded]);

  useEffect(() => {
    onBothPlayersReadyRef.current = onBothPlayersReady;
  }, [onBothPlayersReady]);

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
   *
   * Uses functional state updates (prev => ...) to avoid stale closure on gameState.
   * Uses refs for callbacks to prevent constant listener re-registration.
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

      // For fresh games (no moves yet), don't start the clock until
      // both players are ready (signaled via GAME_SYNC)
      if (payload.game.moves.length === 0) {
        setWaitingForOpponent(true);
      }
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

      onBothPlayersReadyRef.current?.();
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

      // Use functional update to avoid stale closure on gameState
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentFen: payload.gameState.currentFen,
          currentTurn: payload.gameState.currentTurn,
          moves: [...prev.moves, payload.move],
        };
      });

      setTimeLeft({
        white: payload.gameState.whiteTimeLeft,
        black: payload.gameState.blackTimeLeft,
      });

      // Reset draw offer when a move is made
      setDrawOffered(false);
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

      // Use functional update to avoid stale closure on gameState
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentFen: payload.gameState.currentFen,
          currentTurn: payload.gameState.currentTurn,
          moves: [...prev.moves, payload.move],
        };
      });

      setTimeLeft({
        white: payload.gameState.whiteTimeLeft,
        black: payload.gameState.blackTimeLeft,
      });

      // Reset draw offer when opponent moves
      setDrawOffered(false);
      setCanMove(true);
    };

    const handleGameEnded = (payload: GameEndedPayload) => {
      console.log('[Game] Game ended:', payload);

      // Update gameState status so the internal timer stops
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'COMPLETED' as GameState['status'],
        };
      });

      setCanMove(false);
      setDrawOffered(false);
      onGameEndedRef.current?.(payload);
    };

    const handleDrawOffer = () => {
      console.log('[Game] Draw offered by opponent');
      setDrawOffered(true);
    };

    const handleDrawDeclined = () => {
      console.log('[Game] Draw declined by opponent');
      setDrawOffered(false);
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
    socket.on(SOCKET_EVENTS.DRAW_DECLINED, handleDrawDeclined);
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
      socket.off(SOCKET_EVENTS.DRAW_DECLINED, handleDrawDeclined);
      socket.off(SOCKET_EVENTS.INVALID_MOVE, handleInvalidMove);
      socket.off(SOCKET_EVENTS.GAME_ERROR, handleGameError);
    };
  }, [socket, gameId]);

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

  return {
    gameState,
    yourColor,
    canMove,
    isLoading,
    error,
    latency,
    timeLeft,
    drawOffered,
    waitingForOpponent,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    leaveGame,
  };
}
