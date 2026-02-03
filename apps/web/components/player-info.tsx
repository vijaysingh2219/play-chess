import { UserProfileDialog } from '@/components/profile/user-profile-popover';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { DisplayUser } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { cn } from '@workspace/ui/lib/utils';
import { formatTime } from '@workspace/utils/helpers';
import type { GameState } from '@workspace/utils/types';
import { Clock } from 'lucide-react';
import { InlineCapturedPieces } from './captured-pieces';

interface PlayerInfoProps {
  gameState?: GameState;
  user: DisplayUser;
  time: number;
  lowTime?: boolean;
  isTurn?: boolean;
  color: 'w' | 'b';
  showCapturedPieces?: boolean;
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
  className,
}: PlayerInfoProps) {
  const { user: authUser } = useRequiredAuthUser();
  const isAuthUser = authUser?.id === user.id;

  return (
    <div className={cn('flex items-center justify-between rounded-lg', className)}>
      <div className="flex items-center gap-3">
        <div className="bg-background text-foreground flex h-10 w-10 items-center justify-center rounded-full">
          <Avatar className="h-full w-full rounded">
            <AvatarImage src={user.image ?? ''} alt={user.username || ''} />
            <AvatarFallback className="rounded text-2xl">
              {user.username ? user.username[0] : ''}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="grid-rows-2">
          <p className="text-xs font-medium sm:text-sm">
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
          {showCapturedPieces && (
            <InlineCapturedPieces gameId={gameState?.id || ''} color={color} />
          )}
        </div>
      </div>
      <div
        className={cn(
          'text-accent-foreground bg-muted flex items-center justify-between gap-2 rounded p-2 font-bold',
          'text-sm sm:text-lg md:text-xl',
          isTurn ? 'opacity-100' : 'opacity-60',
          lowTime && 'bg-red-600',
        )}
      >
        <Clock className={cn('size-5')} />
        <span aria-label={`Time remaining: ${formatTime(time)}`} className="flex-grow">
          {formatTime(time)}
        </span>
      </div>
    </div>
  );
}
