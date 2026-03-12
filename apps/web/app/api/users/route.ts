import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for query parameters
const searchUsersSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryParams = {
    username: url.searchParams.get('username')?.trim() ?? '',
  };

  // Validate query parameters
  const parsed = searchUsersSchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { username } = parsed.data;

  try {
    // Partial match query
    const result = await prisma.user.findMany({
      where: {
        username: {
          contains: username, // Partial match
          mode: 'insensitive', // Case-insensitive
        },
      },
      take: 10, // Limit results for performance
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        rating: true,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/users]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
