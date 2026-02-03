'use client';

import { IGame as Game } from '@/components/chess/replay-board';
import { IGame, useGameById, useGamesByUser } from '@/hooks/queries/games';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { downloadPGN, generatePGNString } from '@/lib/pgn';
import { getPlayerIndicatorClass, renderResultIcon } from '@/lib/utils';
import { Button } from '@workspace/ui/components/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@workspace/ui/components/pagination';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { useIsMobile } from '@workspace/ui/hooks/use-mobile';
import { cn } from '@workspace/ui/lib/utils';
import { formatDate, formatTimeControl } from '@workspace/utils/helpers';
import { Check, Copy, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function UserGames({ userId, limit = 25 }: { userId: string; limit?: number }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGamesByUser(userId, page, limit);

  const isMobile = useIsMobile();
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Player{!isMobile && 's'}</TableHead>
            <TableHead>Score</TableHead>
            {!isMobile && <TableHead>Reason</TableHead>}
            {!isMobile && <TableHead>Date</TableHead>}
            <TableHead>PGN</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(8)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell>
                {isMobile ? (
                  <div>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-4">
                  {!isMobile && (
                    <div className="flex flex-col items-center space-y-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-4" />
                    </div>
                  )}
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              </TableCell>
              {!isMobile && (
                <>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </>
              )}
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!data?.games || data.total === 0) {
    return <p className="text-muted-foreground text-center">No games found.</p>;
  }

  const totalPages = Math.ceil(data.total / limit);
  const startPage = Math.min(Math.max(page, 1), Math.max(totalPages - 4, 1));
  const pagesToShow = Array.from({ length: 5 }, (_, i) => startPage + i).filter(
    (p) => p <= totalPages,
  );

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Player{!isMobile && 's'}</TableHead>
            <TableHead>Score</TableHead>
            {!isMobile && (
              <>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </>
            )}
            <TableHead>PGN</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.games.map((game) => (
            <GameRow key={game.id} game={game} userId={userId} isMobile={isMobile} />
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                aria-disabled={page === 1}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {pagesToShow.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink isActive={page === p} onClick={() => setPage(p)}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                aria-disabled={page === totalPages}
                className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

const GameRow = ({
  game,
  userId,
  isMobile,
}: {
  game: IGame;
  userId: string | null | undefined;
  isMobile: boolean;
}) => {
  const router = useRouter();

  const myColor =
    game.whitePlayerId === userId ? 'white' : game.blackPlayerId === userId ? 'black' : null;

  const opponent =
    myColor === 'white'
      ? {
          ...game.blackPlayer,
          rating: game.blackEloAtStart,
          color: 'black' as 'black' | 'white',
        }
      : myColor === 'black'
        ? {
            ...game.whitePlayer,
            rating: game.whiteEloAtStart,
            color: 'white' as 'black' | 'white',
          }
        : null;

  // Query to fetch game
  const { data } = useGameById(game.id);
  if (!data) return null;

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(`/game/${game.id}`)}>
      <TableCell>{formatTimeControl(game.initialTime, game.incrementTime)}</TableCell>
      <TableCell>
        {isMobile && opponent ? (
          <div className="space-x-1">
            <span>{opponent.username}</span>
            <span className="text-muted-foreground">({opponent.rating})</span>
          </div>
        ) : (
          <>
            <div className="space-x-1">
              <span className={getPlayerIndicatorClass('white', game.winner)} />
              <span>{game.whitePlayer.username}</span>
              <span className="text-muted-foreground">({game.whiteEloAtStart})</span>
            </div>
            <div className="space-x-1">
              <span className={cn(getPlayerIndicatorClass('black', game.winner))} />
              <span>{game.blackPlayer.username}</span>
              <span className="text-muted-foreground">({game.blackEloAtStart})</span>
            </div>
          </>
        )}
      </TableCell>
      <TableCell className={cn('flex flex-row items-center', isMobile ? 'p-4' : 'space-x-4')}>
        {!isMobile && (
          <ScoreColumn
            winner={game.winner}
            className="text-muted-foreground flex w-4 flex-col text-center"
          />
        )}
        <div className="flex items-center justify-center">
          {renderResultIcon(myColor, game.winner)}
        </div>
      </TableCell>
      {!isMobile && (
        <>
          <TableCell>{game.reason}</TableCell>
          <TableCell>{formatDate(game.startedAt, 'PP')}</TableCell>
        </>
      )}
      <TableCell>
        {/* Copy to Clipboard */}
        <CopyPGNButton data={data} />

        {/* Download PGN */}
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            try {
              downloadPGN(data);
              toast.success('PGN downloaded');
            } catch (error) {
              console.error('Failed to download PGN', error);
              toast.error('Failed to download');
            }
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

function ScoreColumn({
  winner,
  className,
}: {
  winner: 'WHITE' | 'BLACK' | 'DRAW' | null;
  className?: string;
}) {
  if (winner === null) {
    return (
      <div className={className}>
        <span>—</span>
        <span>—</span>
      </div>
    );
  }
  if (winner === 'DRAW') {
    return (
      <div className={className}>
        <span>½</span>
        <span>½</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <span>{winner === 'WHITE' ? '1' : '0'}</span>
      <span>{winner === 'BLACK' ? '1' : '0'}</span>
    </div>
  );
}

function CopyPGNButton({ data }: { data: Game }) {
  const [copy, isCopied] = useCopyToClipboard();

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        try {
          const pgn = generatePGNString(data);
          copy(pgn);
          toast.success('Copied to clipboard');
        } catch (error) {
          console.error('Failed to copy PGN', error);
          toast.error('Failed to copy');
        }
      }}
    >
      {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
