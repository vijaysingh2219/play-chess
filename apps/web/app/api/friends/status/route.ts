import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
  }

  const currentUserId = session.user.id;

  if (targetUserId === currentUserId) {
    return NextResponse.json({ status: 'self' });
  }

  try {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
      select: {
        id: true,
        status: true,
        blockedBy: true,
      },
    });

    if (!friendship) {
      return NextResponse.json({ status: 'none', friendshipId: null });
    }

    return NextResponse.json({
      status: friendship.status,
      friendshipId: friendship.id,
      blockedBy: friendship.blockedBy,
    });
  } catch (error) {
    console.error('[GET /api/friends/status]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
