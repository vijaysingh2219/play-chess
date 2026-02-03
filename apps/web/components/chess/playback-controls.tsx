'use client';

/**
 * Playback Controls Component
 *
 * Navigation controls for stepping through move history.
 * Includes first, previous, next, and last move buttons.
 */

import { Button } from '@workspace/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PlaybackControlsProps {
  /** Current move index being viewed (-1 for starting position) */
  currentViewIndex: number;
  /** Total number of moves in the game */
  totalMoves: number;
  /** Whether the user is viewing history (not live position) */
  isViewingHistory: boolean;
  /** Navigate to first move (starting position) */
  onFirstMove: () => void;
  /** Navigate to previous move */
  onPrevMove: () => void;
  /** Navigate to next move */
  onNextMove: () => void;
  /** Navigate to latest move (live position) */
  onLatestMove: () => void;
}

export function PlaybackControls({
  currentViewIndex,
  totalMoves,
  isViewingHistory,
  onFirstMove,
  onPrevMove,
  onNextMove,
  onLatestMove,
}: PlaybackControlsProps) {
  if (totalMoves === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <h3 className="mb-3 text-sm font-medium">Move Navigation</h3>

      <div className="grid grid-cols-4 gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onFirstMove}
              disabled={currentViewIndex <= -1}
              className="h-9"
              aria-label="Go to start"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>First Move (↑)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevMove}
              disabled={currentViewIndex <= -1}
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
              onClick={onNextMove}
              disabled={currentViewIndex >= totalMoves - 1}
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
              onClick={onLatestMove}
              disabled={!isViewingHistory}
              className="h-9"
              aria-label="Go to latest"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Latest Move (↓)</TooltipContent>
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

      {isViewingHistory && (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-center">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Viewing move history • Press ↓ to return to live position
          </p>
        </div>
      )}
    </div>
  );
}
