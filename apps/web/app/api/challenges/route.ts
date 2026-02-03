import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'PENDING' },
          { receiverId: userId, status: 'PENDING' },
        ],
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            rating: true,
            image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            rating: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const incoming = challenges.filter((c) => c.receiverId === userId);
    const outgoing = challenges.filter((c) => c.senderId === userId);

    return NextResponse.json({ incoming, outgoing });
  } catch (error) {
    console.error('[Challenges API] Error fetching challenges:', error);
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
}
