'use client';

import { NewOnlineGame } from '@/components/chess/new-game';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';

function PlayOnline() {
  const { isLoading } = useRequiredAuthUser();

  if (isLoading) {
    return null;
  }

  return <NewOnlineGame />;
}

export default PlayOnline;
