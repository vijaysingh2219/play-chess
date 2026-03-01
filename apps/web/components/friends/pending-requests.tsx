'use client';

import { useCancelRequest } from '@/hooks/mutations/friends';
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
import { User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Pending {
  id: string;
  receiver: {
    id: string;
    name: string;
    username: string;
    rating: number;
    createdAt: Date;
    image: string;
  };
  createdAt: Date;
}

const PendingRequests = ({ userId }: { userId: string }) => {
  const { data: pending } = useRequests(userId, 'sent');
  const cancel = useCancelRequest();
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
          {pending?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                No pending requests
              </TableCell>
            </TableRow>
          )}
          {pending?.map((req: Pending) => (
            <TableRow key={req.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={req.receiver.image} alt={req.receiver.username} />
                  <AvatarFallback>{req.receiver.username[0]}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{req.receiver.username}</TableCell>
              <TableCell>{req.receiver.rating}</TableCell>
              <TableCell>{formatDate(req.createdAt, 'PPP')}</TableCell>
              <TableCell className="flex justify-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => cancel.mutate(req.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel request</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewProfile(req.receiver.username)}
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

export default PendingRequests;
