'use client';

import { Logo } from '@/components/ui/logo';
import ThemeSwitch from '@/components/ui/theme-switch';
import { useSession } from '@workspace/auth/client';
import { Button } from '@workspace/ui/components/button';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Header() {
  const pathname = usePathname();

  if (pathname === '/') {
    return <MarketingHeader />;
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center justify-between gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Link href="/">
          <Logo variant="text-only" classes={{ text: '' }} />
        </Link>
      </div>
      <div>
        <ThemeSwitch />
      </div>
    </header>
  );
}

function MarketingHeader() {
  const { data, isPending } = useSession();
  const isAuthenticated = Boolean(data?.user);

  return (
    <header className="border-border/60 bg-background/80 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center">
        <Logo variant="text-only" classes={{ text: '' }} />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeSwitch />
        {!isPending && !isAuthenticated && (
          <>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
