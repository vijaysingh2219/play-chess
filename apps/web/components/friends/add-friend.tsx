'use client';

import { useSendFriendRequest } from '@/hooks/mutations/friends';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const { mutate, isPending } = useSendFriendRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    mutate(identifier, {
      onSuccess: () => {
        setIdentifier('');
        setOpen(false);
        toast.success('Friend request sent');
      },
      onError: (error) => {
        toast.error(error.message ?? 'Failed to send request');
        console.error(error);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Friend</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Friend Request</DialogTitle>
          <DialogDescription>Enter a username or email to send a friend request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              Send Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
