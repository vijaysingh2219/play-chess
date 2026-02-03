'use client';

import { customPieces } from '@/components/chess/custom-pieces';
import { Button } from '@workspace/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';
import type { Square } from 'chess.js';
import { Repeat2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import {
  PieceDropHandlerArgs,
  PieceHandlerArgs,
  Chessboard as ReactChessboard,
  SquareHandlerArgs,
} from 'react-chessboard';

export interface ChessboardWrapperProps {
  /** Current FEN position */
  position: string;
  /** Initial board orientation */
  initialOrientation?: 'white' | 'black';
  /** Whether pieces can be dragged */
  allowDragging?: boolean;
  /** Callback when a piece starts being dragged */
  onPieceDrag?: (args: PieceHandlerArgs) => boolean;
  /** Callback when a piece is dropped */
  onPieceDrop?: (args: PieceDropHandlerArgs) => boolean;
  /** Callback when a square is clicked */
  onSquareClick?: (args: SquareHandlerArgs) => void;
  /** Custom square styles for highlighting */
  squareStyles?: Record<Square, React.CSSProperties>;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the flip board button */
  showFlipButton?: boolean;
  /** Whether to allow board flipping */
  allowFlip?: boolean;
  /** Custom children to render (e.g., promotion dialog) */
  children?: React.ReactNode;
}

/**
 * Reusable chessboard wrapper component with flip functionality
 * Consolidates the chessboard logic used across OnlineGame, NewOnlineGame, and ReplayBoard
 */
export const ChessboardWrapper: React.FC<ChessboardWrapperProps> = ({
  position,
  initialOrientation = 'white',
  allowDragging = false,
  onPieceDrag,
  onPieceDrop,
  onSquareClick,
  squareStyles,
  className,
  showFlipButton = false,
  allowFlip = true,
  children,
}) => {
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(initialOrientation);

  const toggleOrientation = () => {
    if (allowFlip) {
      setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {showFlipButton && (
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Flip board orientation. Currently showing ${boardOrientation} perspective`}
                className="h-10 w-10"
                onClick={toggleOrientation}
                disabled={!allowFlip}
              >
                <Repeat2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Flip Board (X)</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="mx-auto aspect-square w-full max-w-[625px] rounded-xl border-2 shadow-lg">
        <ReactChessboard
          options={{
            position,
            boardOrientation,
            allowDragging,
            allowDragOffBoard: false,
            onPieceDrag,
            onPieceDrop,
            onSquareClick,
            squareStyles,
            pieces: customPieces,
          }}
        />
        {children}
      </div>
    </div>
  );
};
