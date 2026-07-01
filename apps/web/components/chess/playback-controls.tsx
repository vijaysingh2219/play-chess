'use client';

/**
 * Playback Controls Component
 *
 * Navigation controls for stepping through move history. Renders first,
 * previous, next, and last buttons, with an optional Play/Pause autoplay
 * button (for replays) and an optional "viewing history" banner (for live
 * games). Shared by the live game view and the replay board.
 */

import { Button } from '@workspace/ui/components/button';
import { Kbd } from '@workspace/ui/components/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
  Pause,
  Play,
} from 'lucide-react';

/** Arrow key tokens are rendered as Lucide icons; other keys (Home, End) as text. */
const KEY_ICONS: Record<string, LucideIcon> = {
  '↑': ArrowUp,
  '↓': ArrowDown,
  '←': ArrowLeft,
  '→': ArrowRight,
};

/** Tooltip content: a label followed by one or more keyboard-key chips. */
function TooltipHint({ label, keys }: { label: string; keys?: string[] }) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      {keys?.map((key) => {
        const Icon = KEY_ICONS[key];
        return <Kbd key={key}>{Icon ? <Icon /> : key}</Kbd>;
      })}
    </span>
  );
}

interface PlaybackControlsProps {
  /** Current move index being viewed (-1 for starting position) */
  currentViewIndex: number;
  /** Total number of moves in the game */
  totalMoves: number;
  /** Whether a past position (not the latest) is being viewed */
  isViewingHistory: boolean;
  /** Navigate to first move (starting position) */
  onFirstMove: () => void;
  /** Navigate to previous move */
  onPrevMove: () => void;
  /** Navigate to next move */
  onNextMove: () => void;
  /** Navigate to latest move (live position) */
  onLatestMove: () => void;
  /** Panel heading (default "Move Navigation") */
  title?: string;
  /** Label for the first-move button tooltip (default "First Move") */
  firstMoveLabel?: string;
  /** Label for the last-move button tooltip (default "Latest Move") */
  lastMoveLabel?: string;
  /**
   * Optional autoplay control rendered between prev and next. When provided,
   * the grid expands to five columns and shows a Play/Pause toggle.
   */
  autoPlay?: {
    isPlaying: boolean;
    onToggle: () => void;
  };
  /** Show the amber "viewing history" banner while browsing history (default true) */
  showHistoryBanner?: boolean;
}

export function PlaybackControls({
  currentViewIndex,
  totalMoves,
  isViewingHistory,
  onFirstMove,
  onPrevMove,
  onNextMove,
  onLatestMove,
  title = 'Move Navigation',
  firstMoveLabel = 'First Move',
  lastMoveLabel = 'Latest Move',
  autoPlay,
  showHistoryBanner = true,
}: PlaybackControlsProps) {
  const atStart = currentViewIndex <= -1;
  const atEnd = currentViewIndex >= totalMoves - 1;

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>

      <div className={autoPlay ? 'grid grid-cols-5 gap-2' : 'grid grid-cols-4 gap-2'}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onFirstMove}
              disabled={atStart}
              className="h-9"
              aria-label="Go to start"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <TooltipHint label={firstMoveLabel} keys={['↑', 'Home']} />
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevMove}
              disabled={atStart}
              className="h-9"
              aria-label="Previous move"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <TooltipHint label="Previous Move" keys={['←']} />
          </TooltipContent>
        </Tooltip>

        {autoPlay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={autoPlay.onToggle}
                disabled={atEnd}
                className="h-9"
                aria-label={autoPlay.isPlaying ? 'Pause' : 'Play'}
              >
                {autoPlay.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipHint label={autoPlay.isPlaying ? 'Pause' : 'Play'} keys={['Space']} />
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextMove}
              disabled={atEnd}
              className="h-9"
              aria-label="Next move"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <TooltipHint label="Next Move" keys={['→']} />
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onLatestMove}
              disabled={atEnd}
              className="h-9"
              aria-label="Go to latest"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <TooltipHint label={lastMoveLabel} keys={['↓', 'End']} />
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Move counter */}
      <div className="text-muted-foreground mt-3 text-center text-sm">
        {currentViewIndex === -1 ? (
          'Starting Position'
        ) : (
          <>
            Move {currentViewIndex + 1} of {totalMoves}
            {isViewingHistory && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">(History)</span>
            )}
          </>
        )}
      </div>

      {showHistoryBanner && isViewingHistory && (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-center">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Viewing move history • Press ↓ to return to live position
          </p>
        </div>
      )}
    </div>
  );
}
