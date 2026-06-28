import { Button } from '@workspace/ui/components/button';
import { Crown, Play, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { ChessBoard } from './chess-board';

export function Hero({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="text-center lg:text-left">
          <div className="border-border/60 bg-background/60 text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Players online now
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Make your move,
            <span className="from-primary to-primary/60 mt-2 block bg-linear-to-r bg-clip-text text-transparent">
              master the board.
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-lg text-lg leading-relaxed text-pretty lg:mx-0">
            Challenge friends or get matched with players worldwide in real time. Track your rating,
            replay your games, and climb the leaderboard — no download required.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Button asChild size="lg" className="gap-2 text-base font-semibold">
              <Link href="/play/online">
                <Play className="h-5 w-5" />
                {isAuthenticated ? 'Continue playing' : 'Play Now'}
              </Link>
            </Button>
            {!isAuthenticated && (
              <Button asChild variant="outline" size="lg" className="text-base">
                <Link href="/sign-up">Create free account</Link>
              </Button>
            )}
          </div>

          <div className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="text-primary h-4 w-4" />
              Free to play
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="text-primary h-4 w-4" />
              Live Elo ratings
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Crown className="text-primary h-4 w-4" />
              Global leaderboard
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <ChessBoard />

          {/* Floating crown badge */}
          <div className="bg-primary text-primary-foreground absolute -top-3 -right-3 rounded-full p-3 shadow-lg sm:-top-5 sm:-right-5">
            <Crown className="h-6 w-6" />
          </div>
        </div>
      </div>
    </section>
  );
}
