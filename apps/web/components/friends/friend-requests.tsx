'use client';

import { useRespondToRequest } from '@/hooks/mutations/friends';
import { useRequests } from '@/hooks/queries/friends';
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
import { Check, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Request {
  id: string;
  sender: {
    id: string;
    name: string;
    username: string;
    rating: number;
    createdAt: Date;
    image: string;
  };
  createdAt: Date;
}

const FriendRequests = ({ userId }: { userId: string }) => {
  const { data: requests } = useRequests(userId, 'received');
  const respond = useRespondToRequest(userId);
  const router = useRouter();

  const handleViewProfile = (username: string) => {
    router.push(`/member/${username}`);
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[10%]">Avatar</TableHead>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Elo Rating</TableHead>
            <TableHead className="w-[20%]">Requested At</TableHead>
            <TableHead className="w-[15%] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((req: Request) => (
            <TableRow key={req.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={req.sender.image} alt={req.sender.username} />
                  <AvatarFallback>{req.sender.username[0]}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{req.sender.username}</TableCell>
              <TableCell>{req.sender.rating}</TableCell>
              <TableCell>{formatDate(req.createdAt, 'PPP')}</TableCell>
              <TableCell className="flex justify-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => respond.mutate({ friendId: req.id, action: 'accept' })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => respond.mutate({ friendId: req.id, action: 'reject' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewProfile(req.sender.username)}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View profile</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default FriendRequests;
