import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const blocked = await prisma.friendship.findMany({
      where: {
        status: 'BLOCKED',
        blockedBy: userId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        id: true,
        blockedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            rating: true,
            image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            rating: true,
            image: true,
          },
        },
      },
    });

    // Map to return the blocked user (the other party)
    const blockedUsers = blocked.map((f) => {
      const blockedUser = f.sender.id === userId ? f.receiver : f.sender;
      return {
        id: f.id,
        blockedAt: f.blockedAt,
        user: blockedUser,
      };
    });

    return NextResponse.json({ data: blockedUsers });
  } catch (error) {
    console.error('[GET /api/friends/blocked]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
