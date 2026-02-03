import { queryKeys } from '@/lib/query';
import { useQuery } from '@tanstack/react-query';

export const useSubscription = () => {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: async () => {
      const res = await fetch('/api/subscription');
      if (!res.ok) {
        throw new Error('Failed to fetch subscription');
      }
      const data = await res.json();
      return data.subscription;
    },
  });
};
