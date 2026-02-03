import { generatePageMetadata } from '@/config/metadata';
import { Metadata } from 'next';

interface MemberLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: MemberLayoutProps): Promise<Metadata> {
  const username = (await params).username;
  const metadata = generatePageMetadata(
    `${username} - Chess Profile`,
    `View the profile of ${username}, check their games, stats, and performance in real-time chess matches.`,
    { noindex: true },
  );
  return metadata;
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
