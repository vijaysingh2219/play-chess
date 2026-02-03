import { generatePageMetadata, pageMetadata } from '@/config/metadata';

export const metadata = generatePageMetadata(
  pageMetadata.play.online.title,
  pageMetadata.play.online.description,
);

export default function PlayOnlineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
