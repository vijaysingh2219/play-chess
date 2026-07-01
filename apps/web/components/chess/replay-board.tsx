'use client';

import { customPieces } from '@/components/chess/custom-pieces';
import { GameLayout } from '@/components/chess/game-layout';
import { MoveHistory } from '@/components/chess/move-history';
import { useKeyboardShortcuts } from '@/contexts/keyboard-shortcuts-context';
import { useGameById } from '@/hooks/queries/games';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useChessKeyboardShortcuts } from '@/hooks/use-chess-keyboard-shortcuts';
import { useReplayControls } from '@/hooks/use-replay-controls';
import { DisplayUser } from '@/types';
import { GameResult, Move, MoveData } from '@workspace/contracts';
import { Game } from '@workspace/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { cn } from '@workspace/ui/lib/utils';
import { formatTimeControlDisplay } from '@workspace/utils/helpers';
import { useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { formatGameEndReason } from './game-over';
import { PlaybackControls } from './playback-controls';

export interface IGame extends Game {
  moves: Move[];
  result: GameResult;
  winner: 'WHITE' | 'BLACK' | 'DRAW' | null;
  whitePlayer: DisplayUser;
  blackPlayer: DisplayUser;
  timeControl: string;
  initialTime: number;
  incrementTime: number;
}

export function ReplayBoard({ className, gameId }: { className?: string; gameId: string }) {
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const { showShortcuts, setContext } = useKeyboardShortcuts();

  // Set context to replay mode
  useEffect(() => {
    setContext('replay');
  }, [setContext]);

  // Fetch game data
  const { data } = useGameById(gameId);
  const moveList: MoveData[] = useMemo(() => data?.moves ?? [], [data]);

  // Auth user — non-redirecting so replay is viewable without login
  const { user: authUser } = useAuthUser();

  // Use replay controls hook
  const {
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
  } = useReplayControls({
    moves: moveList,
    initialTime: data?.initialTime ? data.initialTime * 1000 : undefined,
    incrementTime: data?.incrementTime ? data.incrementTime * 1000 : undefined,
    playInterval: 500,
  });

  // Keyboard shortcuts
  useChessKeyboardShortcuts({
    actions: {
      onPrevMove: prev,
      onNextMove: next,
      onFirstMove: reset,
      onLastMove: end,
      onGoToMove: goToMove,
      onTogglePlay: togglePlay,
      onFlipBoard: () => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white'),
      onShowHelp: showShortcuts,
      totalMoves: moveList.length,
      currentMoveIndex,
      isReplayMode: true,
    },
  });

  // Get moves up to current position for captured pieces
  const movesUpToCurrentPosition = useMemo(() => {
    if (currentMoveIndex === -1) return [];
    return moveList.slice(0, currentMoveIndex + 1);
  }, [moveList, currentMoveIndex]);

  // Calculate player positions
  const playerPositions = useMemo(() => {
    if (!data) {
      return {
        top: {
          user: { id: '', name: '', username: '', image: null },
          time: 0,
          lowTime: false,
          isTurn: false,
          color: 'b' as const,
          showCapturedPieces: false,
        },
        bottom: {
          user: { id: '', name: '', username: '', image: null },
          time: 0,
          lowTime: false,
          isTurn: false,
          color: 'w' as const,
          showCapturedPieces: false,
        },
      };
    }

    const currentTurn = getCurrentTurn();
    const whiteTime = getTimeAtMove('white');
    const blackTime = getTimeAtMove('black');

    const whitePlayer = {
      user: {
        id: data.whitePlayer.id,
        name: data.whitePlayer.name,
        username: data.whitePlayer.username,
        image: data.whitePlayer.image,
        rating: data.whitePlayer.rating,
        createdAt: data.whitePlayer.createdAt,
      },
      time: whiteTime,
      lowTime: false,
      isTurn: currentTurn === 'w',
      color: 'w' as const,
      showCapturedPieces: true,
      moves: movesUpToCurrentPosition,
    };

    const blackPlayer = {
      user: {
        id: data.blackPlayer.id,
        name: data.blackPlayer.name,
        username: data.blackPlayer.username,
        image: data.blackPlayer.image,
        rating: data.blackPlayer.rating,
        createdAt: data.blackPlayer.createdAt,
      },
      time: blackTime,
      lowTime: false,
      isTurn: currentTurn === 'b',
      color: 'b' as const,
      showCapturedPieces: true,
      moves: movesUpToCurrentPosition,
    };

    // Arrange based on board orientation
    if (boardOrientation === 'white') {
      return { top: blackPlayer, bottom: whitePlayer };
    } else {
      return { top: whitePlayer, bottom: blackPlayer };
    }
  }, [data, boardOrientation, getCurrentTurn, getTimeAtMove, movesUpToCurrentPosition]);

  // Render chessboard
  const chessboard = (
    <div className="aspect-square h-full w-full rounded-xl border-2 shadow-lg">
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          allowDragging: false,
          pieces: customPieces,
        }}
      />
    </div>
  );

  const sideControls = (
    <div className="flex flex-col gap-4 group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:flex-1">
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
          >
            <MoveHistory
              moves={moveList}
              onMoveClick={(index) => goToMove(index)}
              activeIndex={currentMoveIndex}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="info"
          className="rounded-xl border p-4 group-data-[split=true]/side-panel:min-h-0 group-data-[split=true]/side-panel:overflow-y-auto"
        >
          {data ? (
            <div className="space-y-3 text-sm">
              {/* Outcome banner */}
              {data.winner && (
                <div className="bg-muted/40 rounded-lg border p-2.5 text-center font-medium">
                  {data.winner === 'DRAW'
                    ? `Draw${data.reason ? ` by ${formatGameEndReason(data.reason).toLowerCase()}` : ''}`
                    : `${data.winner === 'WHITE' ? data.whitePlayer.username : data.blackPlayer.username} won${data.reason ? ` by ${formatGameEndReason(data.reason).toLowerCase()}` : ''}`}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Started</span>
                <span className="text-right font-medium">
                  {new Date(data.createdAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'long',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{formatTimeControlDisplay(data.timeControl)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Variant</span>
                {/* No variant/rated field on Game yet — all games are standard & rated. */}
                <span className="font-medium">Standard (Rated)</span>
              </div>

              {/* Rating change — only shown to participants */}
              {(() => {
                const viewerIsWhite = authUser?.id === data.whitePlayer.id;
                const viewerIsBlack = authUser?.id === data.blackPlayer.id;
                const change = viewerIsWhite
                  ? data.eloChangeWhite
                  : viewerIsBlack
                    ? data.eloChangeBlack
                    : null;
                if (change == null) return null;
                return (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Rating change</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        change > 0
                          ? 'text-green-600 dark:text-green-500'
                          : change < 0
                            ? 'text-red-600 dark:text-red-500'
                            : 'text-muted-foreground',
                      )}
                    >
                      {change > 0 ? '+' : ''}
                      {change}
                    </span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Loading…</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="shrink-0">
        <PlaybackControls
          currentViewIndex={currentMoveIndex}
          totalMoves={moveList.length}
          isViewingHistory={false}
          onFirstMove={reset}
          onPrevMove={prev}
          onNextMove={next}
          onLatestMove={end}
          title="Playback Controls"
          firstMoveLabel="Start of Game"
          lastMoveLabel="End of Game"
          autoPlay={{ isPlaying, onToggle: togglePlay }}
          showHistoryBanner={false}
        />
      </div>
    </div>
  );

  return (
    <GameLayout
      className={className}
      topPlayer={playerPositions.top}
      bottomPlayer={playerPositions.bottom}
      chessboard={chessboard}
      sideControls={sideControls}
      onFlipBoard={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
      boardOrientation={boardOrientation}
    />
  );
}
