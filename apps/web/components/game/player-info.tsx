import { UserProfileDialog } from '@/components/profile/user-profile-popover';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { DisplayUser } from '@/types';
import type { GameState, MoveData } from '@workspace/contracts';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { cn } from '@workspace/ui/lib/utils';
import { formatTime } from '@workspace/utils/helpers';
import { Clock } from 'lucide-react';
import { InlineCapturedPieces, InlineReplayCapturedPieces } from './captured-pieces';

interface PlayerInfoProps {
  gameState?: GameState;
  user: DisplayUser;
  time: number;
  lowTime?: boolean;
  isTurn?: boolean;
  color: 'w' | 'b';
  showCapturedPieces?: boolean;
  /** Replay moves — when provided, captured pieces are derived from these instead of the game socket. */
  moves?: MoveData[];
  className?: string;
}

export function PlayerInfo({
  gameState,
  user,
  time,
  lowTime,
  isTurn,
  color,
  showCapturedPieces = false,
  moves,
  className,
}: PlayerInfoProps) {
  const { user: authUser } = useRequiredAuthUser();
  const isAuthUser = authUser?.id === user.id;

  return (
    <div className={cn('flex items-center justify-between rounded-lg', className)}>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 rounded">
          <AvatarImage src={user.image ?? ''} alt={user.username || ''} />
          <AvatarFallback className="text-lg font-medium">
            {user.username ? user.username[0]?.toUpperCase() : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium sm:text-sm">
            <UserProfileDialog
              user={user}
              showAddFriend={!isAuthUser}
              showChallenge={!isAuthUser}
              showStats={isAuthUser}
              showGamesHistory={isAuthUser}
              className="space-x-1"
            >
              <span>{user.username}</span>
              <span className="text-muted-foreground">
                {user.rating !== undefined && user.rating !== null ? `(${user.rating})` : ''}
              </span>
            </UserProfileDialog>
          </p>
          {showCapturedPieces &&
            (moves ? (
              <InlineReplayCapturedPieces moves={moves} color={color} />
            ) : (
              <InlineCapturedPieces gameId={gameState?.id || ''} color={color} />
            ))}
        </div>
      </div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 font-bold tabular-nums sm:px-3 sm:py-2',
          'text-sm sm:text-lg md:text-xl',
          isTurn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          lowTime && 'bg-red-600 text-white',
          lowTime && isTurn && 'animate-pulse',
        )}
        role="timer"
        aria-live={isTurn ? 'polite' : 'off'}
      >
        <Clock className="size-3 shrink-0 sm:size-4" />
        <span aria-label={`Time remaining: ${formatTime(time)}`}>{formatTime(time)}</span>
      </div>
    </div>
  );
}
