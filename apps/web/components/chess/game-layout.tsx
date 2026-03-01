'use client';

import { PlayerInfo } from '@/components/game/player-info';
import { DisplayUser } from '@/types';
import { Button } from '@workspace/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';
import { GameState } from '@workspace/utils';
import { Repeat2 } from 'lucide-react';
import type React from 'react';
import { ReactNode } from 'react';

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
      className={cn('mx-auto max-w-7xl p-2 sm:p-4', className)}
      role="main"
      aria-label="Chess Game Interface"
    >
      <TooltipProvider>
        <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:gap-8">
          {/* Left column - Players and Board */}
          <div className="space-y-2">
            <PlayerInfo {...topPlayer} />

            {/* Board with toolbar */}
            <div className="relative">
              {chessboard}

              {/* Board toolbar - overlay on desktop only */}
              <div className="absolute bottom-2 right-2 hidden items-center gap-1 sm:flex">
                {latency !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'bg-background/80 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium backdrop-blur-sm',
                          getLatencyColor(latency),
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', getLatencyDot(latency))} />
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

          {/* Right column - Side controls and additional content */}
          <div className="space-y-4">
            {sideControls}
            {additionalContent}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};
