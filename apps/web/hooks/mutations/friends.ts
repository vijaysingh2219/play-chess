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
        // Include retryAfter in the error message for cooldown handling
        if (error?.retryAfter) {
          const retryDate = new Date(error.retryAfter);
          const now = new Date();
          const diffMs = retryDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          throw new Error(
            `Please wait ${diffDays} day${diffDays !== 1 ? 's' : ''} before re-sending a request to this user`,
          );
        }
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

export const useBlockUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Failed to block user');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('User blocked successfully.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list('') });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.received });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.sent });
      queryClient.invalidateQueries({ queryKey: queryKeys.blocked.list });
    },
    onError: (error) => {
      toast.error(error.message ?? 'Could not block user. Please try again.');
    },
  });
};

export const useBlockFriend = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Failed to block user');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('User blocked successfully.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.received });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.sent });
      queryClient.invalidateQueries({ queryKey: queryKeys.blocked.list });
    },
    onError: (error) => {
      toast.error(error.message ?? 'Could not block user. Please try again.');
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const res = await fetch(`/api/friends/unblock/${friendshipId}`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Failed to unblock user');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('User unblocked successfully.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocked.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list('') });
    },
    onError: (error) => {
      toast.error(error.message ?? 'Could not unblock user. Please try again.');
    },
  });
};
