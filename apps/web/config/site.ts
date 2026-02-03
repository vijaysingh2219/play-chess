import { Gamepad2, Home, Library, Trophy, Users } from 'lucide-react';
import { Metadata } from 'next';

export const siteConfig: Metadata = {
  title: 'Play Chess',
  description: 'A ',
  icons: {
    icon: [{ url: '/favicon.ico' }],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  keywords: [
    'turborepo',
    'starter',
    'template',
    'react',
    'typescript',
    'nextjs',
    'tailwindcss',
    'prisma',
    'postgresql',
    'shadcn/ui',
    'better-auth',
    'resend',
    'react-email',
  ],
  openGraph: {
    title: 'Play Chess',
    description: 'A starter template for building applications with Turborepo.',
    url: process.env.NEXT_PUBLIC_BASE_URL ?? 'https://turborepo.org',
    siteName: 'Play Chess',
    images: [
      {
        url: 'https://turborepo.com/_next/image?url=%2Fimages%2Fdocs%2Fslow-tasks-dark.png&w=1920&q=75',
        width: 1200,
        height: 630,
        alt: 'Play Chess',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Play Chess',
    description: 'A starter template for building applications with Turborepo.',
    images: [
      'https://turborepo.com/_next/image?url=%2Fimages%2Fdocs%2Fslow-tasks-dark.png&w=1920&q=75',
    ],
  },
};

export const config = {
  name: 'Play Chess',
  description: siteConfig.description,
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
  domain: process.env.NEXT_PUBLIC_DOMAIN,
  providers: [
    {
      id: 'google',
      name: 'Google',
    },
  ],
  nav: [
    {
      title: 'Home',
      href: '/',
      icon: Home,
    },
    {
      title: 'Play',
      href: '/play/online',
      icon: Gamepad2,
    },
    {
      title: 'Friends',
      href: '/friends',
      icon: Users,
    },
    {
      title: 'Games',
      href: '/games',
      icon: Library,
    },
    {
      title: 'Leaderboard',
      href: '/leaderboard',
      icon: Trophy,
    },
  ],
};
