'use client';

import { OnlineGame } from '@/components/chess/online-game';
import { ReplayBoard } from '@/components/chess/replay-board';
import { useGameById } from '@/hooks/queries/games';
import { useParams } from 'next/navigation';

function GamePage() {
  const params = useParams();
  const gameId = params.id as string;

  // Fetch the initial game status via REST API (not a socket connection)
  // This avoids creating duplicate socket listeners for the same game.
  const { data: game, isLoading } = useGameById(gameId);

  if (!gameId || isLoading) return null;

  // Show ReplayBoard only for games that were already completed when the page loaded.
  // For ONGOING games, OnlineGame handles the full lifecycle including the
  // GameOverDialog — it must not be unmounted when the game ends.
  if (game?.status !== 'ONGOING') {
    return <ReplayBoard gameId={gameId} />;
  }

  return <OnlineGame gameId={gameId} />;
}

export default GamePage;
