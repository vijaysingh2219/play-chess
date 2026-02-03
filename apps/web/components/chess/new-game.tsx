'use client';

import { customPieces } from '@/components/chess/custom-pieces';
import { GameLayout, PlayerPosition } from '@/components/chess/game-layout';
import { SearchControls } from '@/components/chess/search-controls';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';

interface NewOnlineGameProps {
  className?: string;
}

export const NewOnlineGame: React.FC<NewOnlineGameProps> = ({ className }) => {
  const { user } = useRequiredAuthUser();
  const router = useRouter();

  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const { isSearching, matchFound, findMatch, cancelSearch, latency } = useMatchmaking();
  const [displayedLatency, setDisplayedLatency] = useState<number | null>(null);

  useEffect(() => {
    if (latency !== null && latency !== undefined) {
      setDisplayedLatency(latency);
    }
  }, [latency]);

  useEffect(() => {
    if (matchFound) {
      console.log('[Matchmaking] Match found:', matchFound);
      router.push(`/game/${matchFound.gameId}`);
    }
  }, [matchFound, router]);

  const playerPositions = useMemo((): { top: PlayerPosition; bottom: PlayerPosition } => {
    return {
      top: {
        user: { id: '', name: '', username: '', image: null, rating: null, createdAt: null },
        time: 0,
        lowTime: false,
        isTurn: false,
        capturedPieces: { w: [], b: [] },
        color: 'w' as 'w' | 'b',
      },
      bottom: {
        user: {
          id: user?.id || '',
          name: user?.name,
          username: user?.username || '',
          image: user?.image || null,
          rating: user?.rating || null,
          createdAt: user?.createdAt || null,
        },
        time: 0,
        lowTime: false,
        isTurn: false,
        capturedPieces: { w: [], b: [] },
        color: 'b' as 'w' | 'b',
      },
    };
  }, [user]);

  const chessboard = (
    <div className="mx-auto aspect-square w-full max-w-[625px] rounded-xl border-2 shadow-lg">
      <ReactChessboard
        options={{
          position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          boardOrientation,
          allowDragging: false,
          allowDragOffBoard: false,
          pieces: customPieces,
        }}
      />
    </div>
  );

  const sideControls = (
    <SearchControls findMatch={findMatch} leaveQueue={cancelSearch} isSearching={isSearching} />
  );

  return (
    <GameLayout
      className={className}
      topPlayer={playerPositions.top}
      bottomPlayer={playerPositions.bottom}
      chessboard={chessboard}
      sideControls={sideControls}
      onFlipBoard={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
      boardOrientation={boardOrientation}
      latency={displayedLatency}
    />
  );
};
