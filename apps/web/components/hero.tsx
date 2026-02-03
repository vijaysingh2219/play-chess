import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Crown, Play } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-16">
      {/* Background gradient */}
      <div className="from-primary/5 to-secondary/5 absolute inset-0 -z-10 bg-gradient-to-br via-transparent" />

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="bg-muted/50 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Players online now
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight lg:text-6xl">
              <span className="text-primary">Play Chess</span>
              <span className="text-muted-foreground mt-2 block">Anytime, Anywhere</span>
            </h1>
            <p className="text-muted-foreground mx-auto mb-8 max-w-lg text-lg leading-relaxed lg:mx-0">
              Challenge friends or players worldwide to exciting chess matches. Improve your skills,
              track your progress, and enjoy seamless gameplay.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="gap-2 text-base font-semibold">
                <Link href="/play/online">
                  <Play className="h-5 w-5" />
                  Play Now
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base">
                <Link href="/sign-up">Create Free Account</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-xl">
            <Card className="shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <div className="grid grid-cols-8 gap-0.5 sm:gap-1">
                  {Array.from({ length: 64 }, (_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const isLight = (row + col) % 2 === 0;
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm transition-colors ${
                          isLight ? 'bg-muted' : 'bg-muted-foreground'
                        }`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <div className="bg-primary text-primary-foreground absolute -right-2 -top-2 rounded-full p-3 shadow-lg sm:-right-4 sm:-top-4">
              <Crown className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
