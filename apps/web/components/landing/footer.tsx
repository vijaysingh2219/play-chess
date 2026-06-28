import { Logo } from '@/components/ui/logo';
import { config } from '@/config/site';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Play',
    items: [
      { label: 'Play online', href: '/play/online' },
      { label: 'Leaderboard', href: '/leaderboard' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/60 border-t">
      <div className="container mx-auto grid grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4">
        <div className="col-span-2">
          <Logo variant="text-only" />
          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
            Play chess online, challenge friends, and climb the global leaderboard.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold">{column.title}</h3>
            <ul className="mt-3 space-y-2">
              {column.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/60 border-t">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © {year} {config.name}. All rights reserved.
          </p>
          <Link
            href="https://github.com/vijaysingh2219/play-chess"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            GitHub
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
