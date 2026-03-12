import { auth } from '@workspace/auth/server';
import { Prisma, prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const getGamesSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
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
    userId: url.searchParams.get('userId'),
    limit: url.searchParams.get('limit') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
  };

  const parsed = getGamesSchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { userId, limit, page } = parsed.data;
  const skip = (page - 1) * limit;

  const whereClause = {
    OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
  };

  try {
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where: whereClause,
        orderBy: { startedAt: 'desc' },
        include: {
          whitePlayer: { select: { username: true } },
          blackPlayer: { select: { username: true } },
        },
        take: limit,
        skip,
      }),
      prisma.game.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      games,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[GET /api/games]', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Games not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
