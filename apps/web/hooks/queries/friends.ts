import { queryKeys } from '@/lib/query';
import { useQuery } from '@tanstack/react-query';

export const useFriends = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.friends.list(userId),
    queryFn: async () => {
      const res = await fetch(`/api/friends?id=${userId}&type=friend`);
      if (!res.ok) throw new Error('Failed to fetch friends');
      const data = await res.json();
      return data.data;
    },
    enabled: !!userId,
  });
};

export const useRequests = (userId: string, type: 'sent' | 'received') => {
  return useQuery({
    queryKey: queryKeys.requests[type],
    queryFn: async () => {
      const res = await fetch(`/api/friends?id=${userId}&type=${type}&status=PENDING`);
      if (!res.ok) throw new Error('Failed to fetch requests');
      return (await res.json()).data;
    },
    enabled: !!userId,
  });
};

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: queryKeys.blocked.list,
    queryFn: async () => {
      const res = await fetch('/api/friends/blocked');
      if (!res.ok) throw new Error('Failed to fetch blocked users');
      return (await res.json()).data;
    },
  });
};

export const useFriendshipStatus = (targetUserId: string) => {
  return useQuery({
    queryKey: queryKeys.friends.status(targetUserId),
    queryFn: async () => {
      const res = await fetch(`/api/friends/status?userId=${targetUserId}`);
      if (!res.ok) throw new Error('Failed to fetch friendship status');
      return res.json();
    },
    enabled: !!targetUserId,
  });
};
