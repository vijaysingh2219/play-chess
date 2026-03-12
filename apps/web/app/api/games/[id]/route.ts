import { auth } from '@workspace/auth/server';
import { Prisma, prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const gameParamsSchema = z.object({
  id: z.string().min(1, 'Game ID is required'),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const parsed = gameParamsSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const gameId = parsed.data.id;

  try {
    const result = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        moves: {
          orderBy: { moveNumber: 'asc' },
        },
        whitePlayer: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
            rating: true,
            createdAt: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
            rating: true,
            createdAt: true,
          },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
    });
  } catch (error) {
    console.error('[GET /api/games/:gameId]', error);

    // Check if it's a Prisma known error
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
