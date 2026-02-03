import { generatePageMetadata, pageMetadata } from '@/config/metadata';

export const metadata = generatePageMetadata(
  pageMetadata.games.title,
  pageMetadata.games.description,
  { noindex: true },
);

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
