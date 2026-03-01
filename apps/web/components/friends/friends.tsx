'use client';

import { useBlockFriend, useRemoveFriend } from '@/hooks/mutations/friends';
import { useFriends } from '@/hooks/queries/friends';
import { useSubscription } from '@/hooks/subscriptions';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { useChallenge } from '@/hooks/use-challenge';
import { defaultTimeControl, timeControls } from '@/lib/time-controls';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { formatDate } from '@workspace/utils/helpers';
import { Ban, Swords, User, UserX } from 'lucide-react';
import { useRouter } from 'next/dist/client/components/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface Friend {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    rating: number;
    createdAt: Date;
    image: string;
  };
  createdAt: Date;
}

const Friends = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const { data: friends } = useFriends(userId);
  const removeFriendMutation = useRemoveFriend(userId);
  const blockFriendMutation = useBlockFriend(userId);
  const { user } = useRequiredAuthUser();
  const { data: subscription } = useSubscription(userId);
  const { sendChallenge } = useChallenge();

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState(defaultTimeControl.key); // Default to 5+0

  if (!user) return null;

  const sessionUserId = user.id;

  const handleChallengeClick = (friendUserId: string) => {
    if (!subscription) {
      toast.info('Pro Feature', {
        description:
          'Challenging friends is a Pro feature. Upgrade your membership to access this.',
      });
      return;
    }

    setSelectedFriendId(friendUserId);
    setChallengeDialogOpen(true);
  };

  const handleSendChallenge = async () => {
    if (!selectedFriendId) return;

    const timeControl = timeControls.find((tc) => tc.key === selectedTimeControl);
    if (!timeControl) return;

    await sendChallenge(selectedFriendId, timeControl.key);

    setChallengeDialogOpen(false);
    setSelectedFriendId(null);
  };

  const handleViewProfile = (username: string) => {
    router.push(`/member/${username}`);
  };

  const handleRemoveFriend = (friendId: string) => {
    removeFriendMutation.mutate(friendId);
  };

  const handleBlockFriend = (friendId: string) => {
    blockFriendMutation.mutate(friendId);
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[10%]">Avatar</TableHead>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Elo Rating</TableHead>
            <TableHead className="w-[20%]">Friend Since</TableHead>
            <TableHead className="w-[15%] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {friends?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                No friends yet
              </TableCell>
            </TableRow>
          )}
          {friends?.map((friend: Friend) => (
            <TableRow key={friend.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={friend.user.image} alt={friend.user.username} />
                  <AvatarFallback>{friend.user.username[0]}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{friend.user.username}</TableCell>
              <TableCell>{friend.user.rating}</TableCell>
              <TableCell>{formatDate(friend.createdAt, 'PPP')}</TableCell>
              <TableCell className="flex justify-center">
                <div className="flex space-x-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleChallengeClick(friend.user.id)}
                      >
                        <Swords className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Challenge to a game</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewProfile(friend.user.username)}
                      >
                        <User className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View profile</TooltipContent>
                  </Tooltip>

                  {sessionUserId === userId && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFriend(friend.id)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove friend</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleBlockFriend(friend.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Block user</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Challenge to a game</DialogTitle>
            <DialogDescription>Select a time control for your challenge.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="time-control">Time Control</Label>
              <Select value={selectedTimeControl} onValueChange={setSelectedTimeControl}>
                <SelectTrigger id="time-control" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeControls.map((tc) => (
                    <SelectItem key={tc.key} value={tc.key}>
                      {tc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChallengeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendChallenge}>Send Challenge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default Friends;
