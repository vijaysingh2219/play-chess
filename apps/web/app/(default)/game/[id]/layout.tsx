import { generatePageMetadata, pageMetadata } from '@/config/metadata';

export const metadata = generatePageMetadata(
  pageMetadata.game.title,
  pageMetadata.game.description,
  { noindex: true },
);

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
