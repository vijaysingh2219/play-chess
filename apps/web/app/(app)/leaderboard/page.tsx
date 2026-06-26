'use client';

import LeaderboardUsers from '@/components/profile/leaderboard-users';
import { Trophy } from 'lucide-react';

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Trophy className="text-primary h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-muted-foreground">See how you rank against other players</p>
      </div>
      <LeaderboardUsers />
    </div>
  );
}
