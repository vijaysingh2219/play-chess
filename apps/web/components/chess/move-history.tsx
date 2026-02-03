'use client';

import { ScrollArea } from '@workspace/ui/components/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import { cn } from '@workspace/ui/lib/utils';
import { MoveData } from '@workspace/utils';
import { memo, useCallback, useEffect, useRef } from 'react';

interface MoveHistoryProps {
  moves: MoveData[];
  className?: string;
  onMoveClick?: (index: number) => void;
  activeIndex?: number;
}

interface MoveRowProps {
  moveNumber: number;
  whiteMove: MoveData;
  blackMove?: MoveData;
  whiteIndex: number;
  blackIndex: number;
  activeIndex?: number;
  onMoveClick?: (index: number) => void;
  isLast: boolean;
  lastRowRef: React.RefObject<HTMLTableRowElement | null>;
}

/**
 * Individual move row component - memoized to prevent unnecessary re-renders
 */
const MoveRow = memo<MoveRowProps>(
  ({
    moveNumber,
    whiteMove,
    blackMove,
    whiteIndex,
    blackIndex,
    activeIndex,
    onMoveClick,
    isLast,
    lastRowRef,
  }: MoveRowProps) => {
    const handleWhiteClick = useCallback(() => {
      onMoveClick?.(whiteIndex);
    }, [onMoveClick, whiteIndex]);

    const handleBlackClick = useCallback(() => {
      onMoveClick?.(blackIndex);
    }, [onMoveClick, blackIndex]);

    const moveCellBase = 'transition-colors rounded-md';
    const clickableMoveCell = 'cursor-pointer hover:bg-muted/50';
    const activeMoveCell = 'font-semibold text-primary bg-muted/70';

    return (
      <TableRow ref={isLast ? lastRowRef : null}>
        <TableCell className="text-muted-foreground font-medium">{moveNumber}.</TableCell>
        <TableCell
          onClick={onMoveClick ? handleWhiteClick : undefined}
          className={cn(
            moveCellBase,
            onMoveClick && clickableMoveCell,
            activeIndex === whiteIndex && activeMoveCell,
          )}
          role={onMoveClick ? 'button' : undefined}
          tabIndex={onMoveClick ? 0 : undefined}
          onKeyDown={
            onMoveClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWhiteClick();
                  }
                }
              : undefined
          }
          aria-label={`White move ${moveNumber}: ${whiteMove.san}`}
        >
          {whiteMove.san}
        </TableCell>
        <TableCell
          onClick={onMoveClick && blackMove ? handleBlackClick : undefined}
          className={cn(
            moveCellBase,
            onMoveClick && blackMove && clickableMoveCell,
            activeIndex === blackIndex && activeMoveCell,
          )}
          role={onMoveClick && blackMove ? 'button' : undefined}
          tabIndex={onMoveClick && blackMove ? 0 : undefined}
          onKeyDown={
            onMoveClick && blackMove
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBlackClick();
                  }
                }
              : undefined
          }
          aria-label={blackMove ? `Black move ${moveNumber}: ${blackMove.san}` : 'No move'}
        >
          {blackMove ? blackMove.san : '—'}
        </TableCell>
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimization
    return (
      prevProps.whiteMove === nextProps.whiteMove &&
      prevProps.blackMove === nextProps.blackMove &&
      prevProps.activeIndex === nextProps.activeIndex &&
      prevProps.isLast === nextProps.isLast
    );
  },
);

MoveRow.displayName = 'MoveRow';

/**
 * Move history table component with optimized rendering
 */
export const MoveHistory = memo<MoveHistoryProps>(
  ({
    moves,
    className,
    onMoveClick,
    activeIndex,
  }: {
    moves: MoveData[];
    className?: string;
    onMoveClick?: (index: number) => void;
    activeIndex?: number;
  }) => {
    const lastRowRef = useRef<HTMLTableRowElement | null>(null);
    const isMobile = useIsMobile();

    // Auto-scroll to latest move on desktop
    useEffect(() => {
      if (!isMobile && lastRowRef.current && moves.length > 0) {
        lastRowRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, [moves.length, isMobile]);

    // Group moves into pairs for display
    const moveRows = [];
    for (let i = 0; i < moves.length; i += 2) {
      const whiteMove = moves[i];
      if (!whiteMove) continue;
      const moveNumber = Math.floor(i / 2) + 1;
      const blackMove = moves[i + 1];
      const isLast = i + 2 >= moves.length;

      moveRows.push({
        moveNumber,
        whiteMove,
        blackMove,
        whiteIndex: i,
        blackIndex: i + 1,
        isLast,
      });
    }

    // Empty state
    if (moves.length === 0) {
      return (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm font-medium">No moves yet</p>
          <p className="text-muted-foreground/70 text-xs">Moves will appear here as you play</p>
        </div>
      );
    }

    return (
      <div className={cn('', className)}>
        <ScrollArea className="h-60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>White</TableHead>
                <TableHead>Black</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moveRows.map((row) => (
                <MoveRow
                  key={row.whiteIndex}
                  {...row}
                  activeIndex={activeIndex}
                  onMoveClick={onMoveClick}
                  lastRowRef={lastRowRef}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  },
);

MoveHistory.displayName = 'MoveHistory';
