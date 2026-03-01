import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: friendshipId } = await params;

  if (!friendshipId) {
    return NextResponse.json({ error: 'Missing friendship ID' }, { status: 400 });
  }

  try {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Friendship not found' }, { status: 404 });
    }

    // Only the blocker can unblock
    if (friendship.status !== 'BLOCKED') {
      return NextResponse.json({ error: 'This user is not blocked' }, { status: 400 });
    }

    if (friendship.blockedBy !== userId) {
      return NextResponse.json(
        { error: 'Only the person who blocked can unblock' },
        { status: 403 },
      );
    }

    // Delete the friendship record entirely (clean slate)
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return NextResponse.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('[PUT /api/friends/unblock/[id]]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
