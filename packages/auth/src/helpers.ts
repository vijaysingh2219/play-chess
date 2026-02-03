import { prisma } from '@workspace/db';
import { getUsernameFromEmail } from '@workspace/utils/helpers';

/**
 * Generates a unique username from an email address
 * Uses the utility function to extract base username and appends number if taken
 */
export async function generateUniqueUsername(email: string): Promise<string> {
  const baseUsername = getUsernameFromEmail(email);
  let username = baseUsername;
  let counter = 1;

  try {
    // Check if username exists in database
    let existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    // Keep incrementing counter until we find an available username
    while (existingUser) {
      username = `${baseUsername}${counter}`;
      counter++;
      existingUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
    }
  } catch (error) {
    console.error('Error checking username uniqueness:', error);
    // Fallback to timestamped username if error occurs
    username = `${baseUsername}${Date.now()}`;
  }

  return username;
}
