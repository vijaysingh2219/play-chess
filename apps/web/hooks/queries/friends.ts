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
