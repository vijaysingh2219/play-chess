import { prisma } from '@workspace/db';
import { getUsernameFromEmail } from '@workspace/utils/helpers';

// Derive a unique username from the email's local part for sign-ups that don't
// provide one (e.g. Google).
export async function generateUniqueUsername(email: string): Promise<string | undefined> {
  const base = getUsernameFromEmail(email);
  if (!base) return undefined;

  // Try the clean base first; on collision, append a random 4-digit suffix.
  let candidate = base;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}
