'use client';

import { customPieces } from '@/components/chess/custom-pieces';
import { GameLayout } from '@/components/chess/game-layout';
import { useKeyboardShortcuts } from '@/contexts/keyboard-shortcuts-context';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { useChessboard } from '@/hooks/use-chess-board';
import { useChessKeyboardShortcuts } from '@/hooks/use-chess-keyboard-shortcuts';
import { useGameClock } from '@/hooks/use-game-clock';
import { useGameSocket } from '@/hooks/use-game-socket';
import { useLatencyDisplay } from '@/hooks/use-latency-display';
import { usePlayerPositions } from '@/hooks/use-player-positions';
import type { GameTerminationReason, PromotionPiece, Winner } from '@workspace/contracts';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Kbd } from '@workspace/ui/components/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import { cn } from '@workspace/ui/lib/utils';
import { Chess } from 'chess.js';
import Image from 'next/image';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';
import { GameControls } from './game-controls';
import { GameInfo } from './game-info';
import { GameOverDialog } from './game-over';
import { MoveHistory } from './move-history';
import { PlaybackControls } from './playback-controls';

interface GameResult {
  winner: Winner;
  reason: GameTerminationReason;
  eloChanges: {
    white: number;
    black: number;
  };
  newRatings: {
    white: number;
    black: number;
  };
}

interface OnlineGameProps {
  className?: string;
  gameId: string;
}

export const OnlineGame: React.FC<OnlineGameProps> = ({ className, gameId }) => {
  const { user } = useRequiredAuthUser();

  // UI state
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const { showShortcuts, setContext } = useKeyboardShortcuts();

  // Playback state for navigating through game history
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null);

  // Set context to live mode
  useEffect(() => {
    setContext('live');
  }, [setContext]);

  // Game socket connection
  const {
    gameState,
    yourColor,
    canMove,
    timeLeft,
    drawOffered,
    waitingForOpponent,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    latency,
  } = useGameSocket({
    gameId: gameId,
    onGameEnded: (payload) => {
      setGameResult(payload);
      setGameOver(true);
    },
    onBothPlayersReady: () => {
      console.log('Both players ready, game starting!');
    },
  });

  // Last inputs used to sync board orientation (not the whole gameState, so
  // moves don't reset a manual flip).
  const [prevOrientationKey, setPrevOrientationKey] = useState<{
    whitePlayerId?: string;
    userId?: string;
  }>({});

  // Custom hooks for common logic
  const displayedLatency = useLatencyDisplay(latency);

  const isGameActive = gameState?.status === 'ONGOING' && gameResult === null;

  // Only start the display clock after both players are ready (waitingForOpponent === false)
  const isClockRunning = isGameActive && !waitingForOpponent;

  const displayTime = useGameClock({
    timeLeft,
    currentTurn: gameState?.currentTurn,
    isGameActive: isClockRunning,
  });

  const isPlayersTurn = useCallback(
    () => (gameState ? gameState?.currentTurn === yourColor : false),
    [gameState, yourColor],
  );

  const playerPositions = usePlayerPositions({
    gameState,
    user,
    displayTime,
    boardOrientation,
    isPlayersTurn,
  });

  // Compute move list and current viewing position
  const moveList = useMemo(() => gameState?.moves || [], [gameState?.moves]);
  const totalMoves = moveList.length;

  // Snap back to live when the viewed index falls out of range (new moves).
  if (viewingMoveIndex !== null && viewingMoveIndex >= totalMoves) {
    setViewingMoveIndex(null);
  }

  const isViewingHistory = viewingMoveIndex !== null;
  const currentViewIndex = isViewingHistory ? viewingMoveIndex : totalMoves - 1;

  // Calculate FEN for the current viewing position
  const viewingFen = useMemo(() => {
    if (!isViewingHistory || !gameState) return gameState?.currentFen;

    const chess = new Chess();
    for (let i = 0; i <= viewingMoveIndex; i++) {
      const move = moveList[i];
      if (move) {
        chess.move({
          from: move.from,
          to: move.to,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        });
      }
    }
    return chess.fen();
  }, [isViewingHistory, viewingMoveIndex, moveList, gameState]);

  // Navigation functions
  const goToMove = useCallback(
    (index: number) => {
      if (index < -1 || index >= totalMoves) return;
      setViewingMoveIndex(index === totalMoves - 1 ? null : index);
    },
    [totalMoves],
  );

  const goToPrevMove = useCallback(() => {
    const targetIndex = currentViewIndex - 1;
    if (targetIndex < -1) return;
    setViewingMoveIndex(targetIndex === totalMoves - 1 ? null : targetIndex);
  }, [currentViewIndex, totalMoves]);

  const goToNextMove = useCallback(() => {
    const targetIndex = currentViewIndex + 1;
    if (targetIndex >= totalMoves) return;
    setViewingMoveIndex(targetIndex === totalMoves - 1 ? null : targetIndex);
  }, [currentViewIndex, totalMoves]);

  const goToFirstMove = useCallback(() => {
    setViewingMoveIndex(-1);
  }, []);

  const goToLatestMove = useCallback(() => {
    setViewingMoveIndex(null);
  }, []);

  // Sync board orientation when the white-player assignment or user changes.
  if (
    gameState &&
    (gameState.whitePlayerId !== prevOrientationKey.whitePlayerId ||
      user?.id !== prevOrientationKey.userId)
  ) {
    setPrevOrientationKey({ whitePlayerId: gameState.whitePlayerId, userId: user?.id });
    const myColor = gameState.whitePlayerId === user?.id ? 'w' : 'b';
    setBoardOrientation(myColor === 'w' ? 'white' : 'black');
  }

  // Chessboard interaction logic
  const {
    pendingPromotion,
    highlightStyles,
    onSquareClick,
    onPieceDrag,
    onPieceDrop,
    handlePromotion,
    cancelPromotion,
    deselectPiece,
  } = useChessboard({
    gameState,
    yourColor,
    canMove,
    onMove: makeMove,
  });

  // Keyboard shortcuts
  useChessKeyboardShortcuts({
    actions: {
      onPrevMove: goToPrevMove,
      onNextMove: goToNextMove,
      onFirstMove: goToFirstMove,
      onLastMove: goToLatestMove,
      onGoToMove: goToMove,
      onFlipBoard: () => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white'),
      onDeselectPiece: deselectPiece,
      onShowHelp: showShortcuts,
      totalMoves,
      isReplayMode: false,
      isPromotionDialogOpen: Boolean(pendingPromotion),
    },
  });

  // Render chessboard
  const chessboard = (
    <div className="aspect-square h-full w-full rounded-xl border-2 shadow-lg">
      <ReactChessboard
        options={{
          position: viewingFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          boardOrientation,
          allowDragging: !isViewingHistory && gameState?.startedAt !== null && canMove,
          allowDragOffBoard: false,
          onPieceDrag: !isViewingHistory ? onPieceDrag : undefined,
          onPieceDrop: !isViewingHistory ? onPieceDrop : undefined,
          onSquareClick: !isViewingHistory ? onSquareClick : undefined,
          squareStyles: !isViewingHistory ? highlightStyles : {},
          pieces: customPieces,
        }}
      />
      {pendingPromotion && !isViewingHistory && (
        <PromotionDialog
          pendingPromotion={pendingPromotion}
          color={yourColor}
          onSelect={handlePromotion}
          onCancel={cancelPromotion}
        />
      )}
    </div>
  );

  // Render side controls with playback navigation
  const sideControls = (
    <div className="flex flex-col gap-4 group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:flex-1">
      {/* Tabbed content area (fills available height when the panel is split) */}
      <Tabs
        defaultValue="moves"
        className="flex flex-col group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="moves">Moves</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent
          value="moves"
          className="rounded-xl border group-data-[split=true]/side-panel:flex group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:flex-col"
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            role="log"
            aria-label="Chess move history"
            aria-live="polite"
          >
            <MoveHistory
              moves={moveList}
              onMoveClick={(index) => goToMove(index)}
              activeIndex={currentViewIndex}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="info"
          className="rounded-xl border p-4 group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:overflow-y-auto"
        >
          <GameInfo
            gameState={gameState}
            result={
              gameResult
                ? {
                    winner: gameResult.winner,
                    reason: gameResult.reason,
                    whiteChange: gameResult.eloChanges.white,
                    blackChange: gameResult.eloChanges.black,
                  }
                : null
            }
          />
        </TabsContent>
      </Tabs>

      {/* Pinned controls */}
      <div className="shrink-0 space-y-4">
        <PlaybackControls
          currentViewIndex={currentViewIndex}
          totalMoves={totalMoves}
          isViewingHistory={isViewingHistory}
          onFirstMove={goToFirstMove}
          onPrevMove={goToPrevMove}
          onNextMove={goToNextMove}
          onLatestMove={goToLatestMove}
        />

        <GameControls
          gameState={gameState}
          drawOffered={drawOffered}
          resign={resign}
          offerDraw={offerDraw}
          acceptDraw={acceptDraw}
          declineDraw={declineDraw}
        />
      </div>
    </div>
  );

  return (
    <>
      <GameLayout
        className={className}
        topPlayer={playerPositions.top}
        bottomPlayer={playerPositions.bottom}
        chessboard={chessboard}
        sideControls={sideControls}
        onFlipBoard={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
        boardOrientation={boardOrientation}
        latency={displayedLatency}
      />
      <GameOverDialog
        isOpen={gameOver}
        result={
          gameResult
            ? {
                winner: gameResult.winner,
                reason: gameResult.reason,
                whiteRating: {
                  change: gameResult.eloChanges.white,
                  new: gameResult.newRatings.white || 0,
                },
                blackRating: {
                  change: gameResult.eloChanges.black,
                  new: gameResult.newRatings.black || 0,
                },
              }
            : null
        }
        currentPlayer={{
          id: user?.id || '',
          name: user?.name || '',
          username: user?.username || '',
          image: user?.image || null,
        }}
        opponent={{
          id: (gameState?.whitePlayerId === user?.id
            ? gameState?.blackPlayerId
            : gameState?.whitePlayerId || '') as string,
          name:
            gameState?.whitePlayerId === user?.id
              ? gameState?.blackPlayer.name
              : gameState?.whitePlayer.name,
          username: (gameState?.whitePlayerId === user?.id
            ? gameState?.blackPlayer.username
            : gameState?.whitePlayer.username) as string,
          image:
            gameState?.whitePlayerId === user?.id
              ? gameState?.blackPlayer.image
              : gameState?.whitePlayer.image,
        }}
        currentPlayerColor={gameState?.whitePlayerId === user?.id ? 'w' : 'b'}
        timeControl={gameState?.timeControl || 'Untimed'}
        onClose={() => {
          setGameOver(false);
        }}
      />
    </>
  );
};

// Promotion dialog component (unchanged)
interface PromotionDialogProps {
  pendingPromotion: { from: string; to: string } | null;
  color: 'w' | 'b' | null;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

export function PromotionDialog({
  pendingPromotion,
  color,
  onSelect,
  onCancel,
}: PromotionDialogProps) {
  const isOpen = Boolean(pendingPromotion);
  const isMobile = useIsMobile();

  const pieces: Array<{
    type: PromotionPiece;
    label: string;
    shortcut: string;
  }> = [
    { type: 'q', label: 'Queen', shortcut: 'Q' },
    { type: 'r', label: 'Rook', shortcut: 'R' },
    { type: 'b', label: 'Bishop', shortcut: 'B' },
    { type: 'n', label: 'Knight', shortcut: 'N' },
  ];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const keyMap: Record<string, PromotionPiece> = {
        q: 'q',
        r: 'r',
        b: 'b',
        n: 'n',
        k: 'n',
      };

      if (keyMap[key]) {
        event.preventDefault();
        onSelect(keyMap[key]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSelect, onCancel]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={onCancel}>
        <DialogHeader>
          <DialogTitle>Promote Your Pawn</DialogTitle>
          <DialogDescription>
            Choose which piece to promote your pawn to
            {!isMobile && (
              <span className="mt-1 block text-xs">Tip: Use keyboard shortcuts (Q, R, B, N)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4"
          role="group"
          aria-label="Promotion piece selection"
        >
          {pieces.map(({ type, label, shortcut }) => (
            <Button
              key={type}
              variant="outline"
              size="lg"
              onClick={() => onSelect(type)}
              className="hover:bg-accent group relative aspect-square h-auto p-4 transition-all hover:scale-105"
              aria-label={`Promote to ${label} (${shortcut})`}
              autoFocus={type === 'q'}
            >
              <div className="flex w-full flex-col items-center gap-2">
                <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                  <Image
                    src={`/pieces/${color}${type}.png`}
                    alt={label}
                    fill
                    className="object-contain"
                    unoptimized
                    priority
                  />
                </div>

                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium">{label}</span>
                  <kbd
                    className={cn(
                      'bg-muted border-border rounded border px-1.5 py-0.5',
                      isMobile ? 'hidden' : '',
                    )}
                  >
                    {shortcut}
                  </kbd>
                </div>

                <div className="group-hover:ring-primary absolute inset-0 rounded-md ring-2 ring-transparent transition-all" />
              </div>
            </Button>
          ))}
        </div>

        {pendingPromotion && (
          <div className="text-muted-foreground pb-2 text-center text-sm">
            {pendingPromotion.from} → {pendingPromotion.to}
          </div>
        )}

        <div className="flex justify-center border-t pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancel <Kbd className={cn(isMobile ? 'hidden' : '')}>ESC</Kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
