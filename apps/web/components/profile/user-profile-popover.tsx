'use client';

import { useSendFriendRequest } from '@/hooks/mutations/friends';
import { DisplayUser } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { Separator } from '@workspace/ui/components/separator';
import { cn } from '@workspace/ui/lib/utils';
import { formatDate } from '@workspace/utils/helpers';
import { BarChart2, CalendarDays, Gamepad2, ListChecks, Trophy, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { toast } from 'sonner';

interface UserProfileDialogProps {
  /** User data to display */
  user: DisplayUser;
  /** Trigger element (e.g., username text) */
  children: ReactNode;
  /** Whether to show the add friend button */
  showAddFriend?: boolean;
  /** Whether to show the challenge button */
  showChallenge?: boolean;
  /** Whether to show the stats button */
  showStats?: boolean;
  /** Whether to show the games history button */
  showGamesHistory?: boolean;
  /** Custom class name for the trigger */
  className?: string;
}

/**
 * Reusable dialog component that shows user profile details
 * Triggered by clicking on a username or other element
 * Closes when clicking outside the dialog
 */
export function UserProfileDialog({
  user,
  children,
  showAddFriend = true,
  showChallenge = true,
  showStats = true,
  showGamesHistory = true,
  className,
}: UserProfileDialogProps) {
  const formatJoinDate = (date?: Date | string) => {
    if (!date) return 'Unknown';
    return formatDate(new Date(date), 'MMM dd, yyyy');
  };
  const { mutate, isPending } = useSendFriendRequest();

  const addFriend = (username?: string | null) => {
    if (!username) return;
    mutate(username, {
      onSuccess: () => {
        toast.success('Friend request sent');
      },
      onError: (error) => {
        toast.error(error.message ?? 'Failed to send request');
        console.error(error);
      },
    });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className={cn('cursor-pointer', className)}>{children}</span>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-md p-0" side="bottom" align="start" sideOffset={8}>
        {/* Hidden dialog header for accessibility */}
        <Card className="sr-only">
          <CardTitle>{user.username}&apos;s Profile</CardTitle>
          <CardDescription>View player information and statistics</CardDescription>
        </Card>

        <Card className="border-0 shadow-none">
          <CardHeader className="flex items-start gap-4 space-y-2">
            {/* Avatar and Basic Info */}
            <Avatar className="h-20 w-20 rounded-lg border-2">
              <AvatarImage src={user.image ?? ''} alt={user.username ?? ''} />
              <AvatarFallback className="text-2xl">
                {user.username ? user.username[0]?.toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1">
              <CardTitle className="text-xl">{user.username}</CardTitle>
              {user.name && <CardDescription className="text-sm">{user.name}</CardDescription>}
              {user.rating !== undefined && user.rating !== null && (
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-600" />
                  <Badge variant="secondary" className="font-semibold">
                    {user.rating}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Join Date */}
            {user.createdAt && (
              <>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4" />
                  <span>Joined {formatJoinDate(user.createdAt)}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {showAddFriend && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => addFriend(user.username)}
                  disabled={!user.username || isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Friend
                </Button>
              )}
              {showChallenge && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => console.log('Challenge user')}
                >
                  <Gamepad2 className="mr-2 h-4 w-4" />
                  Challenge
                </Button>
              )}
              {showStats && (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/stats">
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Stats
                  </Link>
                </Button>
              )}
              {showGamesHistory && (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/games">
                    <ListChecks className="mr-2 h-4 w-4" />
                    Games History
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
