import { generatePageMetadata, pageMetadata } from '@/config/metadata';

export const metadata = generatePageMetadata(
  pageMetadata.membership.title,
  pageMetadata.membership.description,
);

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
