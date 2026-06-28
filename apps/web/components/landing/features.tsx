import { Card, CardContent } from '@workspace/ui/components/card';
import { Clock, History, Swords, Trophy, Users, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time play',
    description: 'Low-latency moves over websockets with live clocks and instant board sync.',
  },
  {
    icon: Users,
    title: 'Challenge friends',
    description: 'Add friends, send direct challenges, and jump straight into a game.',
  },
  {
    icon: Swords,
    title: 'Smart matchmaking',
    description: 'Get paired with opponents near your rating across multiple time controls.',
  },
  {
    icon: Trophy,
    title: 'Elo leaderboard',
    description: 'Earn and lose rating on every game and climb the global rankings.',
  },
  {
    icon: History,
    title: 'Game history & replay',
    description: 'Revisit every match move by move to learn from your wins and losses.',
  },
  {
    icon: Clock,
    title: 'Bullet to rapid',
    description: 'Play the way you like, from lightning bullet to thoughtful rapid games.',
  },
];

export function Features() {
  return (
    <section className="border-border/60 bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Everything you need to play and improve
          </h2>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">
            A complete chess experience built for speed, competition, and progress.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="group hover:border-primary/40 transition-colors hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex h-11 w-11 items-center justify-center rounded-xl transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
