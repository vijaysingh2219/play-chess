import { auth } from '@workspace/auth/server';
import { Prisma, prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for query parameters
const getUserSchema = z
  .object({
    id: z.string().cuid().or(z.string().uuid()).optional(),
    username: z.string().min(1).optional(),
  })
  .refine((data) => data.id || data.username, {
    message: 'Either id or username must be provided',
  });

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryParams = {
    id: url.searchParams.get('id') ?? undefined,
    username: url.searchParams.get('username') ?? undefined,
  };

  // Validate query parameters
  const parsed = getUserSchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { id, username } = parsed.data;

  try {
    const result = await prisma.user.findUnique({
      where: { id, username },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        createdAt: true,
        rating: true,
        gamesAsWhite: true,
        gamesAsBlack: true,
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/user]', error);

    // Check if it's a Prisma known error
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
