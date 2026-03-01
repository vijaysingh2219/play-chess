'use client';

import { useUnblockUser } from '@/hooks/mutations/friends';
import { useBlockedUsers } from '@/hooks/queries/friends';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
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
import { ShieldOff } from 'lucide-react';

interface BlockedUser {
  id: string;
  blockedAt: Date;
  user: {
    id: string;
    name: string;
    username: string;
    rating: number;
    image: string;
  };
}

const BlockedUsers = () => {
  const { data: blockedUsers } = useBlockedUsers();
  const unblockMutation = useUnblockUser();

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[10%]">Avatar</TableHead>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Elo Rating</TableHead>
            <TableHead className="w-[20%]">Blocked At</TableHead>
            <TableHead className="w-[15%] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {blockedUsers?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                No blocked users
              </TableCell>
            </TableRow>
          )}
          {blockedUsers?.map((blocked: BlockedUser) => (
            <TableRow key={blocked.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={blocked.user.image} alt={blocked.user.username} />
                  <AvatarFallback>{blocked.user.username[0]}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{blocked.user.username}</TableCell>
              <TableCell>{blocked.user.rating}</TableCell>
              <TableCell>
                {blocked.blockedAt ? formatDate(blocked.blockedAt, 'PPP') : '—'}
              </TableCell>
              <TableCell className="flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => unblockMutation.mutate(blocked.id)}
                      disabled={unblockMutation.isPending}
                    >
                      <ShieldOff className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Unblock user</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default BlockedUsers;
