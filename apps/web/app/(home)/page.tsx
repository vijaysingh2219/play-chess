import { auth } from '@workspace/auth/server';
import { headers } from 'next/headers';

import { CallToAction } from '@/components/landing/cta';
import { Features } from '@/components/landing/features';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Stats } from '@/components/landing/stats';

export default async function Page() {
  // Public landing page: never let a session/DB hiccup take it down.
  let isAuthenticated = false;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    isAuthenticated = Boolean(session?.user);
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Hero isAuthenticated={isAuthenticated} />
      <Stats />
      <Features />
      <HowItWorks />
      <CallToAction isAuthenticated={isAuthenticated} />
      <Footer />
    </div>
  );
}
