import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for query parameters
const leaderboardSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? Number(val) : 25;
      if (Number.isNaN(parsed) || parsed <= 0) throw new Error('Invalid limit');
      return Math.min(parsed, 50);
    }),
  page: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? Number(val) : 1;
      if (Number.isNaN(parsed) || parsed < 0) throw new Error('Invalid page');
      return parsed;
    }),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryParams = {
    limit: url.searchParams.get('limit') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
  };

  const parsed = leaderboardSchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { limit, page } = parsed.data;
  const skip = (page - 1) * limit;

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
        take: limit,
        skip,
        select: {
          id: true,
          name: true,
          username: true,
          rating: true,
          image: true,
          gamesAsWhite: {
            select: {
              winner: true,
            },
          },
          gamesAsBlack: {
            select: {
              winner: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[GET /api/leaderboard]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
