import { queryKeys } from '@/lib/query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useSendFriendRequest = () => {
  return useMutation({
    mutationFn: async (identifier: string) => {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Failed to send request');
      }

      return res.json();
    },
  });
};

export const useRespondToRequest = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ friendId, action }: { friendId: string; action: 'accept' | 'reject' }) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to respond');
      return res.json();
    },
    onSuccess: (variables) => {
      toast.success(variables.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.list(userId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.received });
    },
    onError: () => {
      toast.error('Could not respond to request. Please try again.');
    },
  });
};

export const useRemoveFriend = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      });

      if (!res.ok) {
        throw new Error('Failed to remove friend');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Friend removed successfully.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.list(userId),
      });
    },
    onError: () => {
      toast.error('Could not remove friend. Please try again.');
    },
  });
};

export const useCancelRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) throw new Error('Failed to cancel request');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Friend request canceled.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.received });
    },
  });
};
