'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { cn } from '@workspace/ui/lib/utils';
import type { GameTerminationReason, Winner } from '@workspace/utils/types';
import { Color } from 'chess.js';
import { Frown, Handshake, Swords, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Player {
  id: string;
  username: string;
  name?: string | null;
  image?: string | null;
}

interface Rating {
  change: number;
  new: number;
}

interface GameOverDialogProps {
  isOpen: boolean;
  result: {
    winner: Winner;
    reason: GameTerminationReason;
    whiteRating: Rating;
    blackRating: Rating;
  } | null;
  currentPlayer: Player;
  opponent: Player;
  currentPlayerColor: Color;
  timeControl?: string;
  onClose?: () => void;
}

export function GameOverDialog({
  isOpen,
  result,
  currentPlayer,
  opponent,
  currentPlayerColor,
  timeControl = '5+0',
  onClose,
}: GameOverDialogProps) {
  const router = useRouter();
  if (!isOpen) return null;

  if (!result) return null;

  // Determine game outcome
  const isDraw = result.winner === 'DRAW';
  const didCurrentPlayerWin =
    !isDraw && result.winner.charAt(0).toLowerCase() === currentPlayerColor;

  // Get rating changes for both players
  const currentPlayerRating = currentPlayerColor === 'w' ? result.whiteRating : result.blackRating;
  const opponentRating = currentPlayerColor === 'w' ? result.blackRating : result.whiteRating;

  // Opponent's color
  const opponentColor: Color = currentPlayerColor === 'w' ? 'b' : 'w';

  // Icon based on outcome
  const OutcomeIcon = didCurrentPlayerWin ? Trophy : isDraw ? Handshake : Frown;
  const outcomeIconColor = didCurrentPlayerWin
    ? 'text-yellow-500'
    : isDraw
      ? 'text-blue-500'
      : 'text-muted-foreground';
  const outcomeBgColor = didCurrentPlayerWin
    ? 'bg-yellow-500/10'
    : isDraw
      ? 'bg-blue-500/10'
      : 'bg-muted';

  // Title based on outcome
  const title = isDraw ? 'Draw!' : didCurrentPlayerWin ? 'Victory!' : 'Defeat';

  const handleNewMatch = () => {
    router.push(`/play/online?tc=${encodeURIComponent(timeControl)}`);
    onClose?.();
  };

  const handleGoHome = () => {
    router.push('/');
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        {/* Header with icon and title */}
        <DialogHeader className="items-center text-center">
          <DialogTitle className="flex flex-col items-center gap-4">
            <div className={cn('rounded-full p-4', outcomeBgColor)}>
              <OutcomeIcon className={cn('h-12 w-12', outcomeIconColor)} aria-hidden="true" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tracking-tight">{title}</div>
              <div className="text-muted-foreground text-sm font-normal">
                by {formatGameEndReason(result.reason)}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogDescription asChild>
          <div className="space-y-6">
            {/* Player cards with rating changes */}
            <div className="flex items-stretch justify-center gap-2 sm:gap-4">
              {/* Current player */}
              <div className="flex flex-col items-center gap-2">
                <PlayerCard
                  player={currentPlayer}
                  color={currentPlayerColor}
                  isWinner={didCurrentPlayerWin && !isDraw}
                />
                <RatingChangeDisplay rating={currentPlayerRating} />
              </div>

              {/* VS icon */}
              <Swords className="text-muted-foreground h-6 w-6 self-center" aria-hidden="true" />

              {/* Opponent */}
              <div className="flex flex-col items-center gap-2">
                <PlayerCard
                  player={opponent}
                  color={opponentColor}
                  isWinner={!didCurrentPlayerWin && !isDraw}
                />
                <RatingChangeDisplay rating={opponentRating} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button onClick={handleNewMatch} className="w-full">
                New {timeControl} Game
              </Button>
              <Button onClick={handleGoHome} variant="outline" className="w-full">
                Return to Home
              </Button>
            </div>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Player Card Component
 * Displays player avatar and info with optional winner styling
 */
function PlayerCard({
  player,
  color,
  isWinner = false,
}: {
  player: Player;
  color: Color;
  isWinner?: boolean;
}) {
  return (
    <div
      className="bg-card flex flex-col items-center gap-2 rounded-xl p-2 shadow-md sm:p-4"
      role="img"
      aria-label={`${player.username}, playing as ${color === 'w' ? 'white' : 'black'}${isWinner ? ', winner' : ''}`}
    >
      <div
        className={cn(
          'bg-muted flex aspect-square h-16 w-16 items-center justify-center rounded-lg border-4',
          color === 'w' && 'border-gray-300',
          color === 'b' && 'border-gray-700',
          isWinner && 'border-green-500 ring-2 ring-green-200',
        )}
      >
        <Avatar className="h-full w-full rounded">
          <AvatarImage src={player.image ?? ''} alt={player.username} />
          <AvatarFallback className="rounded text-3xl capitalize">
            {player.username[0]}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex flex-col items-center">
        {player.name && (
          <span className="max-w-20 truncate text-center text-sm font-medium">{player.name}</span>
        )}
        <span className="text-muted-foreground max-w-20 truncate text-center text-xs font-medium">
          {player.username}
        </span>
      </div>
    </div>
  );
}

/**
 * Rating Change Display Component
 * Shows rating change with appropriate color coding
 */
function RatingChangeDisplay({ rating }: { rating: Rating }) {
  const changeText = rating.change > 0 ? `+${rating.change}` : rating.change.toString();
  const changeColor =
    rating.change > 0
      ? 'text-green-500'
      : rating.change < 0
        ? 'text-red-500'
        : 'text-muted-foreground';

  return (
    <div className="text-center text-sm">
      <div className={cn('font-semibold', changeColor)}>{changeText}</div>
      <div className="text-muted-foreground text-xs">Rating: {rating.new}</div>
    </div>
  );
}

/**
 * Format game end reason for display
 */
function formatGameEndReason(reason: GameTerminationReason): string {
  const reasonMap: Record<GameTerminationReason, string> = {
    CHECKMATE: 'Checkmate',
    RESIGNATION: 'Resignation',
    TIMEOUT: 'Timeout',
    STALEMATE: 'Stalemate',
    INSUFFICIENT_MATERIAL: 'Insufficient Material',
    THREEFOLD_REPETITION: 'Threefold Repetition',
    FIFTY_MOVE_RULE: 'Fifty Move Rule',
    AGREEMENT: 'Agreement',
    DISCONNECTION: 'Game Disconnection',
  };

  return reasonMap[reason] || reason;
}
