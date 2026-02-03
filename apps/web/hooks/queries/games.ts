import { queryKeys } from '@/lib/query';
import { useQuery } from '@tanstack/react-query';
import { Game, User } from '@workspace/db';

type IUser = Pick<User, 'username'>;

export interface IGame extends Game {
  whitePlayer: IUser;
  blackPlayer: IUser;
}

type TUserGamesResponse = {
  games: IGame[];
  total: number;
};

export const useGamesByUser = (userId: string, page: number, limit: number) => {
  return useQuery<TUserGamesResponse>({
    queryKey: queryKeys.games.byUser(userId, page, limit),
    queryFn: async () => {
      const res = await fetch(`/api/games?userId=${userId}&page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      const data = await res.json();
      return data;
    },
    enabled: !!userId,
  });
};

export const useGameById = (gameId: string) => {
  const getGameById = async (gameId: string) => {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) throw new Error('Failed to fetch game');
    return res.json();
  };
  return useQuery({
    queryKey: queryKeys.game.byId(gameId),
    queryFn: () => getGameById(gameId),
    enabled: !!gameId,
  });
};
