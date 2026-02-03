'use client';

import { UserGames } from '@/components/profile/user-games';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';

export default function GamesPage() {
  const { user } = useRequiredAuthUser();
  if (!user) return null;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">My Games</h1>
      <UserGames userId={user.id} />
    </div>
  );
}
