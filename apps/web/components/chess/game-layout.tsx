'use client';

import { PlayerInfo } from '@/components/game/player-info';
import { DisplayUser } from '@/types';
import { GameState } from '@workspace/contracts';
import { Button } from '@workspace/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';
import { Repeat2 } from 'lucide-react';
import type React from 'react';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Measure before paint on the client; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Rough sizes used only to choose the layout mode; the board itself is measured exactly.
const PANEL_WIDTH = 384; // side panel width (w-96)
const COLUMN_GAP = 32; // gap between board and panel (gap-8)
const PLAYERS_HEIGHT = 112; // the two player bars plus their gaps
const CONTAINER_PADDING = 32; // container padding (p-4, both sides)
const HYSTERESIS = 40; // dead-band so the mode doesn't flicker at the threshold

interface GameLayoutMode {
  /** True when there's room to place the panel beside a height-filling board. */
  split: boolean;
  /** Explicit board (and player-bar) width when split; null when single column. */
  boardSize: number | null;
}

// Measures the available area to pick single-column vs. side-by-side, and the
// shared board/player-bar width when split.
function useGameLayoutMode(
  rootRef: React.RefObject<HTMLDivElement | null>,
  rowRef: React.RefObject<HTMLDivElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>,
  boardAreaRef: React.RefObject<HTMLDivElement | null>,
): GameLayoutMode {
  const [mode, setMode] = useState<GameLayoutMode>({ split: false, boardSize: null });
  const splitRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const availWidth = root.clientWidth - CONTAINER_PADDING;
      const availHeight = root.clientHeight - CONTAINER_PADDING;
      const spareWidth = availWidth - PANEL_WIDTH - COLUMN_GAP; // width left for the board
      const spareHeight = availHeight - PLAYERS_HEIGHT; // height between the bars

      // Split only when there's at least as much spare width as height.
      const split = splitRef.current
        ? spareWidth >= spareHeight - HYSTERESIS
        : spareWidth >= spareHeight + HYSTERESIS;
      splitRef.current = split;

      let boardSize: number | null = null;
      if (split) {
        const row = rowRef.current;
        const panel = panelRef.current;
        const boardArea = boardAreaRef.current;
        // Precise once the side-by-side DOM exists; estimate for the first frame.
        if (row && panel && boardArea && getComputedStyle(row).flexDirection === 'row') {
          const gap = parseFloat(getComputedStyle(row).columnGap) || COLUMN_GAP;
          const size = Math.min(row.clientWidth - panel.offsetWidth - gap, boardArea.clientHeight);
          boardSize = size > 0 ? Math.floor(size) : null;
        } else {
          const size = Math.min(spareWidth, spareHeight);
          boardSize = size > 0 ? Math.floor(size) : null;
        }
      }

      setMode((prev) =>
        prev.split === split && prev.boardSize === boardSize ? prev : { split, boardSize },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (rowRef.current) observer.observe(rowRef.current);
    if (panelRef.current) observer.observe(panelRef.current);
    if (boardAreaRef.current) observer.observe(boardAreaRef.current);

    return () => observer.disconnect();
  }, [rootRef, rowRef, panelRef, boardAreaRef]);

  return mode;
}

export interface PlayerPosition {
  user: DisplayUser;
  time: number;
  lowTime: boolean;
  isTurn: boolean;
  capturedPieces?: { w: string[]; b: string[] };
  color: 'w' | 'b';
  gameState?: GameState;
  showCapturedPieces?: boolean;
}

export interface GameLayoutProps {
  /** Player info for top position */
  topPlayer: PlayerPosition;
  /** Player info for bottom position */
  bottomPlayer: PlayerPosition;
  /** Main chessboard component */
  chessboard: ReactNode;
  /** Side controls (game controls or search controls) */
  sideControls: ReactNode;
  /** Optional additional content (like move history) */
  additionalContent?: ReactNode;
  /** Board orientation flip button handler */
  onFlipBoard?: () => void;
  /** Current board orientation */
  boardOrientation?: 'white' | 'black';
  /** Latency in milliseconds */
  latency?: number | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable game layout component
 * Consolidates the layout structure used across OnlineGame and NewOnlineGame
 */
export const GameLayout: React.FC<GameLayoutProps> = ({
  topPlayer,
  bottomPlayer,
  chessboard,
  sideControls,
  additionalContent,
  onFlipBoard,
  boardOrientation = 'white',
  latency,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { split, boardSize } = useGameLayoutMode(rootRef, rowRef, panelRef, boardAreaRef);

  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-muted-foreground';
    if (ms < 50) return 'text-green-600';
    if (ms < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLatencyDot = (ms: number | null) => {
    if (ms === null) return 'bg-muted-foreground';
    if (ms < 50) return 'bg-green-500';
    if (ms < 200) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'mx-auto flex w-full flex-1 flex-col p-2 sm:p-4',
        split ? 'min-h-0 overflow-hidden' : 'overflow-y-auto',
        className,
      )}
      role="main"
      aria-label="Chess Game Interface"
    >
      <TooltipProvider>
        {/* Single column, or a centered board+panel group when split. */}
        <div
          ref={rowRef}
          className={cn(
            'flex',
            split ? 'min-h-0 flex-1 flex-row justify-center gap-8' : 'flex-col gap-6',
          )}
        >
          {/* Board column; shrinks to the board when split so the group can center. */}
          <div className={cn('flex min-h-0 flex-col', split ? 'w-auto shrink-0' : 'w-full')}>
            {/* Board + players; fixed to the measured board width when split so the bars line up. */}
            <div
              className={cn(
                'mx-auto flex flex-col gap-2',
                split ? 'h-full max-w-none' : 'w-full max-w-156.25',
              )}
              style={split && boardSize ? { width: boardSize } : undefined}
            >
              <PlayerInfo {...topPlayer} />

              {/* Board area; fills the height between the players when split. */}
              <div
                ref={boardAreaRef}
                className={cn(
                  'relative w-full',
                  split && 'flex min-h-0 flex-1 items-center justify-center',
                )}
              >
                <div className="relative mx-auto aspect-square w-full">
                  {chessboard}

                  {/* Board toolbar - overlay on desktop only */}
                  <div className="absolute right-2 bottom-2 hidden items-center gap-1 sm:flex">
                    {latency !== undefined && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'bg-background/80 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium backdrop-blur-sm',
                              getLatencyColor(latency),
                            )}
                          >
                            <span
                              className={cn('h-1.5 w-1.5 rounded-full', getLatencyDot(latency))}
                            />
                            {latency !== null ? `${latency}ms` : '—'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Network Latency</TooltipContent>
                      </Tooltip>
                    )}

                    {onFlipBoard && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label={`Flip board orientation. Currently showing ${boardOrientation} perspective`}
                            className="bg-background/80 h-7 w-7 backdrop-blur-sm"
                            onClick={onFlipBoard}
                          >
                            <Repeat2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Flip Board (X)</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile toolbar - below board */}
              <div className="flex items-center justify-between sm:hidden">
                <div className="flex items-center gap-2">
                  {latency !== undefined && (
                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        getLatencyColor(latency),
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', getLatencyDot(latency))} />
                      {latency !== null ? `${latency}ms` : '—'}
                    </div>
                  )}
                </div>
                {onFlipBoard && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Flip board`}
                    className="h-8 gap-1.5 text-xs"
                    onClick={onFlipBoard}
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    Flip
                  </Button>
                )}
              </div>

              <PlayerInfo {...bottomPlayer} />
            </div>
          </div>

          {/* Side panel - controls and move history */}
          <div
            ref={panelRef}
            className={cn(
              'mx-auto w-full max-w-156.25 space-y-4',
              split && 'mx-0 min-h-0 w-96 max-w-none shrink-0 overflow-y-auto',
            )}
          >
            {sideControls}
            {additionalContent}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};
