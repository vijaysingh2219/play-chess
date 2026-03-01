'use client';

import { customPieces } from '@/components/chess/custom-pieces';
import { GameLayout } from '@/components/chess/game-layout';
import { MoveHistory } from '@/components/chess/move-history';
import { useKeyboardShortcuts } from '@/contexts/keyboard-shortcuts-context';
import { useGameById } from '@/hooks/queries/games';
import { useChessKeyboardShortcuts } from '@/hooks/use-chess-keyboard-shortcuts';
import { useReplayControls } from '@/hooks/use-replay-controls';
import { DisplayUser } from '@/types';
import { Game } from '@workspace/db';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip';
import { GameResult, Move, MoveData } from '@workspace/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { ReplayCapturedPieces } from '../game/captured-pieces';

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
      showCapturedPieces: false,
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
      showCapturedPieces: false,
    };

    // Arrange based on board orientation
    if (boardOrientation === 'white') {
      return { top: blackPlayer, bottom: whitePlayer };
    } else {
      return { top: whitePlayer, bottom: blackPlayer };
    }
  }, [data, boardOrientation, getCurrentTurn, getTimeAtMove]);

  // Render chessboard
  const chessboard = (
    <div className="mx-auto aspect-square w-full max-w-[625px] rounded-xl border-2 shadow-lg">
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

  // Render playback controls
  const playbackControls = (
    <div className="space-y-4">
      {/* Playback buttons */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-medium">Playback Controls</h3>
        <div className="grid grid-cols-5 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                disabled={currentMoveIndex <= -1}
                className="h-9"
                aria-label="Go to start"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start of Game (↑ or Home)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={prev}
                disabled={currentMoveIndex <= -1}
                className="h-9"
                aria-label="Previous move"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous Move (←)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={togglePlay}
                disabled={currentMoveIndex >= moveList.length - 1}
                className="h-9"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPlaying ? 'Pause' : 'Play'} (Space)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={next}
                disabled={currentMoveIndex >= moveList.length - 1}
                className="h-9"
                aria-label="Next move"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next Move (→)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={end}
                disabled={currentMoveIndex >= moveList.length - 1}
                className="h-9"
                aria-label="Go to end"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>End of Game (↓ or End)</TooltipContent>
          </Tooltip>
        </div>

        {/* Move counter */}
        <div className="text-muted-foreground mt-3 text-center text-sm">
          {currentMoveIndex === -1 ? (
            'Starting Position'
          ) : (
            <>
              Move {currentMoveIndex + 1} of {moveList.length}
            </>
          )}
        </div>
      </div>

      {/* Game info */}
      {data && (
        <div className="rounded-xl border p-4">
          <h3 className="mb-3 text-sm font-medium">Game Info</h3>
          <div className="space-y-2 text-sm">
            {data.timeControl && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Control:</span>
                <Badge variant="outline" className="font-medium">
                  {data.timeControl}
                </Badge>
              </div>
            )}
            {data.result && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Result:</span>
                <Badge
                  variant={data.winner === 'DRAW' ? 'secondary' : 'default'}
                  className="font-medium"
                >
                  {data.winner === 'WHITE' ? '1-0' : data.winner === 'BLACK' ? '0-1' : '½-½'}
                </Badge>
              </div>
            )}
            {data.winner && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Winner:</span>
                <span className="font-medium">
                  {data.winner === 'WHITE'
                    ? data.whitePlayer.username
                    : data.winner === 'BLACK'
                      ? data.blackPlayer.username
                      : 'Draw'}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Moves:</span>
              <span className="font-medium">{moveList.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Captured pieces - Updates based on current replay position */}
      {moveList.length > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="mb-3 text-sm font-medium">Material</h3>
          <ReplayCapturedPieces moves={movesUpToCurrentPosition} />
        </div>
      )}
    </div>
  );

  // Render move history
  const additionalContent = (
    <div className="rounded-xl border">
      <div className="border-b p-3">
        <h3 className="text-sm font-medium">Move History</h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto" role="log" aria-label="Chess move history">
        <MoveHistory
          moves={moveList}
          onMoveClick={(index) => goToMove(index)}
          activeIndex={currentMoveIndex}
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
      sideControls={playbackControls}
      additionalContent={additionalContent}
      onFlipBoard={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
      boardOrientation={boardOrientation}
    />
  );
}
