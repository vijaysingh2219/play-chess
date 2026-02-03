'use client';

import Friends from '@/components/friends/friends';
import UserRatingChart from '@/components/profile/rating-chart';
import { UserGames } from '@/components/profile/user-games';
import { UserProfile, useUserProfile } from '@/hooks/queries/user';
import { useSubscription } from '@/hooks/subscriptions';
import { Game } from '@workspace/db';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Progress } from '@workspace/ui/components/progress';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { formatDate } from '@workspace/utils/helpers';
import { Crown } from 'lucide-react';
import { notFound, useParams, useRouter } from 'next/navigation';

function prepareRatingHistory(user: UserProfile) {
  const allGames = [...user.gamesAsWhite, ...user.gamesAsBlack].sort(
    (a: Game, b: Game) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  return allGames.map((game) => {
    let rating = user.rating;
    if (game.whitePlayerId === user.id && game.whiteEloAtStart != null) {
      rating = game.whiteEloAtStart;
    } else if (game.blackPlayerId === user.id && game.blackEloAtStart != null) {
      rating = game.blackEloAtStart;
    }
    return {
      date: formatDate(new Date(game.startedAt), 'MMM d'),
      rating,
    };
  });
}

export default function StatsPage() {
  const { username, tab } = useParams<{ username: string; tab: string }>();
  const validTabs = ['games', 'stats', 'friends'];
  const router = useRouter();

  const { data: user, isLoading } = useUserProfile({ username });
  const { data: subscription } = useSubscription(user?.id);

  if (tab && !validTabs.includes(tab)) {
    return notFound();
  }

  if (!username) {
    return <div className="p-6 text-center">Invalid username</div>;
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-screen max-w-5xl space-y-6 p-4 sm:p-6">
        {/* Skeleton for User Card */}
        <div className="flex items-center gap-4 p-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-8 w-3/4 sm:w-1/3" />
            <Skeleton className="h-4 w-2/3 sm:w-1/4" />
          </div>
        </div>

        {/* Skeleton for Tabs */}
        <div className="w-full">
          <Skeleton className="mb-6 h-10 w-full" />

          {/* Content skeleton */}
          <div className="space-y-4">
            {tab === 'stats' ? (
              <Skeleton className="h-64 w-full rounded" />
            ) : (
              <>
                <Skeleton className="h-48 w-full rounded sm:h-64" />
                <Skeleton className="h-48 w-full rounded sm:h-64" />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return notFound();

  function onTabChange(value: string) {
    if (value === 'games' || value === 'stats' || value === 'friends') {
      router.push(`/member/${username}/${value}`);
    } else if (value === 'overview') {
      router.push(`/member/${username}`);
    }
  }

  const ratingHistory = prepareRatingHistory(user);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      {/* User Card */}
      <Card className="from-primary/10 to-secondary/10 overflow-hidden bg-gradient-to-r via-transparent">
        <div className="px-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Avatar className="ring-background h-20 w-20 ring-4 sm:h-24 sm:w-24">
              <AvatarImage src={user.image ?? ''} alt={user.username} />
              <AvatarFallback className="text-2xl font-bold">
                {user.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="text-2xl font-bold tracking-tight">{user.username}</h2>
                {subscription && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                    <Crown className="h-3 w-3" />
                    Pro
                  </span>
                )}
              </div>
              {user.name && <p className="text-muted-foreground">{user.name}</p>}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 text-sm sm:justify-start">
                <span>
                  Joined{' '}
                  <span className="text-foreground font-medium">
                    {formatDate(new Date(user.createdAt), 'MMM d, yyyy')}
                  </span>
                </span>
                <span>
                  Rating <span className="text-foreground font-semibold">{user.rating}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={tab ?? 'overview'} onValueChange={onTabChange}>
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Rating Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pr-4">
              <UserRatingChart data={ratingHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Games</CardTitle>
            </CardHeader>
            <CardContent>
              <UserGames userId={user.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Games Tab */}
        <TabsContent value="games" className="py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Games</CardTitle>
            </CardHeader>
            <CardContent>
              <UserGames userId={user.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="all" className="space-y-6">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Games</TabsTrigger>
                  <TabsTrigger value="white">White</TabsTrigger>
                  <TabsTrigger value="black">Black</TabsTrigger>
                </TabsList>

                {/* All Games Stats */}
                <TabsContent value="all">
                  <StatsGrid
                    games={[...user.gamesAsWhite, ...user.gamesAsBlack]}
                    userId={user.id}
                  />
                </TabsContent>

                {/* As White Stats */}
                <TabsContent value="white">
                  <StatsGrid games={user.gamesAsWhite} userId={user.id} />
                </TabsContent>

                {/* As Black Stats */}
                <TabsContent value="black">
                  <StatsGrid games={user.gamesAsBlack} userId={user.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friends" className="py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Friends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Friends userId={user.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsGrid({ games, userId }: { games: Game[]; userId: string }) {
  let wins = 0,
    draws = 0,
    losses = 0;

  games.forEach((game) => {
    if (game.winner === 'WHITE' && game.whitePlayerId === userId) wins++;
    else if (game.winner === 'BLACK' && game.blackPlayerId === userId) wins++;
    else if (game.winner === 'DRAW') draws++;
    else losses++;
  });

  const total = games.length || 1;

  const winRate = ((wins / total) * 100).toFixed(1);
  const drawRate = ((draws / total) * 100).toFixed(1);
  const lossRate = ((losses / total) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-muted-foreground text-sm">Games</p>
        <p className="text-4xl font-bold">{games.length}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-2xl font-bold text-green-600">{winRate}%</p>
          <Progress value={parseFloat(winRate)} className="[&_div]:bg-green-600" />
          <p className="text-sm text-green-600">{wins} Won</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-yellow-600">{drawRate}%</p>
          <Progress value={parseFloat(drawRate)} className="[&_div]:bg-yellow-600" />
          <p className="text-sm text-yellow-600">{draws} Drawn</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600">{lossRate}%</p>
          <Progress value={parseFloat(lossRate)} className="[&_div]:bg-red-600" />
          <p className="text-sm text-red-600">{losses} Lost</p>
        </div>
      </div>
    </div>
  );
}
