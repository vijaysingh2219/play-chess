import { queryKeys } from '@/lib/query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { useEffect } from 'react';
import { useSocket } from '../use-socket';

interface User {
  id: string;
  username: string;
  rating: number;
  image: string;
}

interface Challenge {
  id: string;
  senderId: string;
  receiverId: string;
  sender: User;
  receiver: User;
  timeControl: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

interface ChallengesData {
  incoming: Challenge[];
  outgoing: Challenge[];
}

export const useChallenges = () => {
  const { socket } = useSocket({ autoConnect: true });
  const queryClient = useQueryClient();

  const query = useQuery<ChallengesData>({
    queryKey: queryKeys.challenges.list,
    queryFn: async () => {
      const res = await fetch('/api/challenges');
      if (!res.ok) throw new Error('Failed to fetch challenges');
      return res.json();
    },
  });

  // Invalidate queries on socket events for real-time updates
  useEffect(() => {
    if (!socket) return;

    const invalidateChallenges = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.list });
    };

    socket.on(SOCKET_EVENTS.CHALLENGE_RECEIVED, invalidateChallenges);
    socket.on(SOCKET_EVENTS.CHALLENGE_EXPIRED, invalidateChallenges);
    socket.on(SOCKET_EVENTS.CHALLENGE_ACCEPTED, invalidateChallenges);
    socket.on(SOCKET_EVENTS.CHALLENGE_DECLINED, invalidateChallenges);
    socket.on(SOCKET_EVENTS.CHALLENGE_CANCELLED, invalidateChallenges);

    return () => {
      socket.off(SOCKET_EVENTS.CHALLENGE_RECEIVED, invalidateChallenges);
      socket.off(SOCKET_EVENTS.CHALLENGE_EXPIRED, invalidateChallenges);
      socket.off(SOCKET_EVENTS.CHALLENGE_ACCEPTED, invalidateChallenges);
      socket.off(SOCKET_EVENTS.CHALLENGE_DECLINED, invalidateChallenges);
      socket.off(SOCKET_EVENTS.CHALLENGE_CANCELLED, invalidateChallenges);
    };
  }, [socket, queryClient]);

  return query;
};

export const useChallengesCount = () => {
  const { data } = useChallenges();
  return data?.incoming.length ?? 0;
};
