import { queryKeys } from '@/lib/query';
import { useQuery } from '@tanstack/react-query';
import { Game, User } from '@workspace/db';
import { z } from 'zod';

export interface IUser {
  id: string;
  name: string;
  username: string;
  image: string;
  rating: number;
}

export interface UserProfile extends User {
  gamesAsWhite: Game[];
  gamesAsBlack: Game[];
  subscription?: {
    currentPeriodEnd: string | null;
  } | null;
}

export const userProfileQuerySchema = z
  .object({
    id: z.string().trim().optional(),
    username: z.string().trim().optional(),
  })
  .refine((data) => data.id || data.username, {
    message: 'Either id or username must be provided',
  });

export function useUserProfile(data: { id?: string; username?: string; enabled?: boolean }) {
  const { id, username, enabled = true } = data;
  const parsed = userProfileQuerySchema.safeParse({ id, username });

  const isQueryEnabled = enabled && parsed.success;

  return useQuery<UserProfile | null, Error>({
    queryKey: queryKeys.user.profile({ id, username }),
    queryFn: async () => {
      if (!parsed.success) return null;

      const params = new URLSearchParams();
      if (parsed.data.id) params.append('id', parsed.data.id);
      if (parsed.data.username) params.append('username', parsed.data.username);

      const res = await fetch(`/api/user?${params.toString()}`);
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'User not found');
      }
      return res.json();
    },
    enabled: isQueryEnabled,
    retry: false,
  });
}

export const userSearchQuerySchema = z.object({
  username: z.string().trim().min(1),
});

export function useUserProfileSearch(data: { username?: string; enabled?: boolean }) {
  const { username, enabled = true } = data;
  const parsed = userSearchQuerySchema.safeParse({ username });

  const isQueryEnabled = enabled && parsed.success;

  return useQuery<IUser[], Error>({
    queryKey: queryKeys.search.users.byUsername(username ?? ''),
    queryFn: async () => {
      if (!parsed.success) return [];

      const params = new URLSearchParams();
      params.append('username', parsed.data.username);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'No users found');
      }

      return res.json();
    },
    enabled: isQueryEnabled,
    retry: false,
  });
}
