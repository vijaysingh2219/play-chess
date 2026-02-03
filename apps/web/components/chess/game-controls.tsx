import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { GameState } from '@workspace/utils';
import { useState } from 'react';

interface GameControlsProps {
  gameState: GameState | null;
  drawOffered: boolean;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
}

export function GameControls({
  gameState,
  drawOffered,
  resign,
  offerDraw,
  acceptDraw,
  declineDraw,
}: GameControlsProps) {
  const [showResignConfirm, setShowResignConfirm] = useState<boolean>(false);
  const [showDrawConfirm, setShowDrawConfirm] = useState<boolean>(false);

  return (
    <div className="rounded-xl border p-4">
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide">
        Game Controls
      </h2>
      {gameState?.status === 'ONGOING' && (
        <div className="space-y-3">
          {drawOffered ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-center text-sm font-medium">Draw offered!</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  onClick={acceptDraw}
                  className="w-full"
                  disabled={!drawOffered}
                  aria-label="Accept draw offer"
                >
                  Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={declineDraw}
                  className="w-full"
                  disabled={!drawOffered}
                  aria-label="Decline draw offer"
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => offerDraw()}
              className="w-full"
              aria-label="Offer a draw"
            >
              Offer Draw
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setShowResignConfirm(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
            aria-label="Resign from current game"
          >
            Resign Game
          </Button>
        </div>
      )}

      {/* Confirm Draw Dialog */}
      <Dialog open={showDrawConfirm} onOpenChange={setShowDrawConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Draw Offer</DialogTitle>
            <DialogDescription>
              Are you sure you want to offer a draw? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDrawConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                offerDraw();
                setShowDrawConfirm(false);
              }}
            >
              Offer Draw
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Resign Dialog */}
      <Dialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Resignation</DialogTitle>
            <DialogDescription>
              Are you sure you want to resign? This will end the game immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowResignConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resign();
                setShowResignConfirm(false);
              }}
            >
              Resign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
