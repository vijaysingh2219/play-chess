import { LogIn, Swords, Trophy } from 'lucide-react';

const STEPS = [
  {
    icon: LogIn,
    title: 'Create your account',
    description: 'Sign up free in seconds with email or Google — no download, no setup.',
  },
  {
    icon: Swords,
    title: 'Find a match',
    description: 'Challenge a friend or get matched instantly with a player at your level.',
  },
  {
    icon: Trophy,
    title: 'Play & climb',
    description: 'Win games, gain rating, and rise up the global leaderboard.',
  },
];

export function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-20 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Start playing in three moves
        </h2>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          From sign-up to checkmate in under a minute.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <div key={title} className="relative flex flex-col items-center text-center">
            <div className="bg-background border-primary/20 text-primary relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 shadow-sm">
              <Icon className="h-7 w-7" />
              <span className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                {index + 1}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
