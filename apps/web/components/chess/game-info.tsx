'use client';

import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import type { GameState, GameTerminationReason, Winner } from '@workspace/contracts';
import { cn } from '@workspace/ui/lib/utils';
import { estimateRatingChange, formatTimeControlDisplay } from '@workspace/utils/helpers';
import { formatGameEndReason } from './game-over';

interface GameInfoResult {
  winner: Winner;
  reason: GameTerminationReason;
  whiteChange: number;
  blackChange: number;
}

interface GameInfoProps {
  gameState: GameState | null;
  /** Present once the game has ended — switches stakes to the actual result. */
  result?: GameInfoResult | null;
}

/**
 * Info tab content for the in-game side panel.
 *
 * While the game is ongoing it shows the viewer's rating stakes (a pure function of
 * the two ratings, so derived here with no extra socket traffic). Once the game ends
 * it shows the outcome and the viewer's actual rating change instead.
 */
export function GameInfo({ gameState, result }: GameInfoProps) {
  const { user: authUser } = useRequiredAuthUser();

  if (!gameState) return null;

  const viewerIsWhite = authUser?.id === gameState.whitePlayerId;
  const viewerIsBlack = authUser?.id === gameState.blackPlayerId;
  const isParticipant = viewerIsWhite || viewerIsBlack;

  const startedAt = new Date(gameState.startedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'long',
  });

  // Rating stakes (ongoing game, participant only).
  const ratingEstimate =
    !result && gameState.status === 'ONGOING' && isParticipant
      ? estimateRatingChange(
          viewerIsWhite ? gameState.whitePlayer.rating : gameState.blackPlayer.rating,
          viewerIsWhite ? gameState.blackPlayer.rating : gameState.whitePlayer.rating,
        )
      : null;

  // Ended-game outcome text + the viewer's actual rating change.
  const outcomeText = result
    ? result.winner === 'DRAW'
      ? `Draw by ${formatGameEndReason(result.reason).toLowerCase()}`
      : `${
          result.winner === 'WHITE'
            ? gameState.whitePlayer.username
            : gameState.blackPlayer.username
        } won by ${formatGameEndReason(result.reason).toLowerCase()}`
    : null;
  const viewerChange =
    result && isParticipant ? (viewerIsWhite ? result.whiteChange : result.blackChange) : null;

  return (
    <div className="space-y-3 p-1 text-sm">
      {outcomeText && (
        <div className="bg-muted/40 rounded-lg border p-2.5 text-center font-medium">
          {outcomeText}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground shrink-0">Started</span>
        <span className="text-right font-medium">{startedAt}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Time</span>
        <span className="font-medium">{formatTimeControlDisplay(gameState.timeControl)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Variant</span>
        {/* No variant/rated field on GameState yet — all games are standard & rated. */}
        <span className="font-medium">Standard (Rated)</span>
      </div>

      {viewerChange !== null && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Rating change</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              viewerChange > 0
                ? 'text-green-600 dark:text-green-500'
                : viewerChange < 0
                  ? 'text-red-600 dark:text-red-500'
                  : 'text-muted-foreground',
            )}
          >
            {viewerChange > 0 ? '+' : ''}
            {viewerChange}
          </span>
        </div>
      )}

      {ratingEstimate && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Win/Loss/Draw</span>
          <span className="font-semibold tabular-nums">
            <span className="text-green-600 dark:text-green-500">+{ratingEstimate.onWin}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-red-600 dark:text-red-500">{ratingEstimate.onLoss}</span>
            <span className="text-muted-foreground"> / </span>
            <span>
              {ratingEstimate.onDraw >= 0 ? '+' : ''}
              {ratingEstimate.onDraw}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
