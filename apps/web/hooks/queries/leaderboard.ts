import { queryKeys } from '@/lib/query';
import { useQuery } from '@tanstack/react-query';
import { Game, User } from '@workspace/db';

type IUser = Pick<User, 'id' | 'name' | 'username' | 'rating' | 'image'>;

type IGame = Pick<Game, 'winner'>;

interface IPlayer extends IUser {
  gamesAsWhite: IGame[];
  gamesAsBlack: IGame[];
}

type TLeaderboardResponse = {
  users: IPlayer[];
  total: number;
  page: number;
  limit: number;
};

export const useLeaderboard = (page: number, limit: number) => {
  return useQuery<TLeaderboardResponse>({
    queryKey: queryKeys.leaderboard({ page, limit }),
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      return data;
    },
    enabled: !!page,
    refetchOnWindowFocus: false,
  });
};
