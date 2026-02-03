'use client';

import { OnlineGame } from '@/components/chess/online-game';
import { ReplayBoard } from '@/components/chess/replay-board';
import { useGameSocket } from '@/hooks/use-game-socket';
import { useParams } from 'next/navigation';

function GamePage() {
  const params = useParams();
  const gameId = params.id as string;

  const { gameState } = useGameSocket({
    gameId: gameId,
  });
  if (!gameId) return null;

  if (gameState?.status !== 'ONGOING') {
    return <ReplayBoard gameId={gameId} />;
  }

  return <OnlineGame gameId={gameId} />;
}

export default GamePage;
