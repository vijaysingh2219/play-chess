'use client';

/**
 * Promotion Dialog Component
 *
 * Displays a dialog for pawn promotion piece selection.
 * Supports keyboard shortcuts for quick selection.
 */

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Kbd } from '@workspace/ui/components/kbd';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import { cn } from '@workspace/ui/lib/utils';
import type { PromotionPiece } from '@workspace/utils/types';
import Image from 'next/image';
import { useEffect } from 'react';

interface PromotionDialogProps {
  /** The pending promotion move, or null if no promotion is pending */
  pendingPromotion: { from: string; to: string } | null;
  /** The color of the promoting player */
  color: 'w' | 'b' | null;
  /** Callback when a promotion piece is selected */
  onSelect: (piece: PromotionPiece) => void;
  /** Callback when promotion is cancelled */
  onCancel: () => void;
}

const PROMOTION_PIECES: Array<{
  type: PromotionPiece;
  label: string;
  shortcut: string;
}> = [
  { type: 'q', label: 'Queen', shortcut: 'Q' },
  { type: 'r', label: 'Rook', shortcut: 'R' },
  { type: 'b', label: 'Bishop', shortcut: 'B' },
  { type: 'n', label: 'Knight', shortcut: 'N' },
];

export function PromotionDialog({
  pendingPromotion,
  color,
  onSelect,
  onCancel,
}: PromotionDialogProps) {
  const isOpen = Boolean(pendingPromotion);
  const isMobile = useIsMobile();

  // Keyboard shortcuts for piece selection
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const keyMap: Record<string, PromotionPiece> = {
        q: 'q',
        r: 'r',
        b: 'b',
        n: 'n',
        k: 'n', // K for Knight (alternative)
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
          {PROMOTION_PIECES.map(({ type, label, shortcut }) => (
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
