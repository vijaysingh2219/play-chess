import { Button } from '@workspace/ui/components/button';
import { Play } from 'lucide-react';
import Link from 'next/link';

export function CallToAction({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <section className="container mx-auto px-4 pb-24">
      <div className="from-primary to-primary/80 relative isolate overflow-hidden rounded-3xl bg-linear-to-br px-6 py-16 text-center shadow-xl sm:px-12">
        {/* Decorative grid */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] bg-size-[2.5rem_2.5rem] opacity-10" />

        <h2 className="text-primary-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Ready to make your move?
        </h2>
        <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl text-lg text-pretty">
          {isAuthenticated
            ? 'Your next game is one click away. Jump back in.'
            : "Join players around the world and start your first game right now. It's free."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="gap-2 text-base font-semibold">
            <Link href="/play/online">
              <Play className="h-5 w-5" />
              {isAuthenticated ? 'Continue playing' : 'Play Now'}
            </Link>
          </Button>
          {!isAuthenticated && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 gap-2 bg-transparent text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/sign-up">Create free account</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
