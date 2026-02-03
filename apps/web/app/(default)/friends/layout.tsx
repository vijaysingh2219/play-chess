import { generatePageMetadata, pageMetadata } from '@/config/metadata';

export const metadata = generatePageMetadata(
  pageMetadata.friends.title,
  pageMetadata.friends.description,
  { noindex: true },
);

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
