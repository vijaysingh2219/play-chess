'use client';

import { useLeaderboard } from '@/hooks/queries/leaderboard';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Badge } from '@workspace/ui/components/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@workspace/ui/components/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Crown, Medal } from 'lucide-react';
import { useState } from 'react';

export default function LeaderboardUsers() {
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useLeaderboard(page, limit);

  const players = data?.users ?? [];

  const getStats = (player: (typeof players)[number]) => {
    let wins = 0,
      draws = 0,
      losses = 0;

    [
      ...player.gamesAsWhite.map((g) => ({ ...g, asWhite: true })),
      ...player.gamesAsBlack.map((g) => ({ ...g, asWhite: false })),
    ].forEach(({ winner, asWhite }) => {
      if (winner === 'DRAW') return draws++;
      const isWin = (asWhite && winner === 'WHITE') || (!asWhite && winner === 'BLACK');
      if (isWin) wins++;
      else losses++;
    });

    const total = wins + draws + losses;
    const pct = (count: number) => (total ? ((count / total) * 100).toFixed(1) : '0.0');
    return {
      wins,
      draws,
      losses,
      winPct: pct(wins),
      drawPct: pct(draws),
      lossPct: pct(losses),
    };
  };

  if (!data?.users || data.total === 0) return null;

  const totalPages = Math.ceil(data.total / limit);
  const startPage = Math.min(Math.max(page, 1), Math.max(totalPages - 4, 1));
  const pagesToShow = Array.from({ length: 5 }, (_, i) => startPage + i).filter(
    (p) => p <= totalPages,
  );

  if (isLoading) return <LeaderboardSkeleton rows={limit} />;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-center">Wins</TableHead>
            <TableHead className="text-center">Draws</TableHead>
            <TableHead className="text-center">Losses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, index) => {
            const { wins, draws, losses, winPct, drawPct, lossPct } = getStats(player);
            return (
              <TableRow key={player.id} className="group">
                <TableCell>
                  {index === 0 && <Crown className="h-5 w-5 text-yellow-500" />}
                  {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                  {index === 2 && <Medal className="h-5 w-5 text-amber-700" />}
                  {index > 2 && (
                    <span className="text-muted-foreground font-semibold">{index + 1}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={player.image ?? ''} alt={player.username} />
                      <AvatarFallback>{player.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{player.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="font-semibold">
                    {player.rating}
                  </Badge>
                </TableCell>
                <StatCell value={wins} pct={winPct} color="text-green-600" />
                <StatCell value={draws} pct={drawPct} color="text-yellow-600" />
                <StatCell value={losses} pct={lossPct} color="text-red-600" />
              </TableRow>
            );
          })}
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

function StatCell({ value, pct, color }: { value: number; pct: string; color: string }) {
  return (
    <TableCell className={`text-center font-semibold ${color}`}>
      <div className="group relative inline-block w-full">
        <span className="transition-opacity duration-200 group-hover:opacity-0">{value}</span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {pct}%
        </span>
      </div>
    </TableCell>
  );
}

function LeaderboardSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          <TableHead className="text-center">Wins</TableHead>
          <TableHead className="text-center">Draws</TableHead>
          <TableHead className="text-center">Losses</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i} className="animate-pulse">
            <TableCell>
              <div className="mx-auto h-4 w-4 rounded" />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full" />
                <div className="h-4 w-24 rounded" />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="mx-auto h-4 w-12 rounded" />
            </TableCell>
            <TableCell className="text-center">
              <div className="mx-auto h-4 w-6 rounded" />
            </TableCell>
            <TableCell className="text-center">
              <div className="mx-auto h-4 w-6 rounded" />
            </TableCell>
            <TableCell className="text-center">
              <div className="mx-auto h-4 w-6 rounded" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
