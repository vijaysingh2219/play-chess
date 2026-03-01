import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const FriendRequestActionSchema = z.object({
  action: z.enum(['accept', 'reject', 'cancel', 'remove', 'block']),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: friendRequestId } = await params;

  if (!userId || !friendRequestId) {
    return NextResponse.json({ error: 'Missing user or friend request ID' }, { status: 400 });
  }

  const body = await req.json();
  const result = FriendRequestActionSchema.parse(body);
  const { action } = result;

  try {
    const fr = await prisma.friendship.findUnique({
      where: { id: friendRequestId },
    });

    if (!fr) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
    }

    if (action === 'accept') {
      if (fr.receiverId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.friendship.update({
        where: { id: friendRequestId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return NextResponse.json({ message: 'Friend request accepted' });
    } else if (action === 'reject') {
      if (fr.receiverId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const newDeclineCount = (fr.declineCount ?? 0) + 1;
      const MAX_DECLINE_COUNT = 3;

      // Auto-block after too many declines
      if (newDeclineCount >= MAX_DECLINE_COUNT) {
        await prisma.friendship.update({
          where: { id: friendRequestId },
          data: {
            status: 'BLOCKED',
            declineCount: newDeclineCount,
            declinedAt: new Date(),
            blockedAt: new Date(),
            blockedBy: userId,
          },
        });

        return NextResponse.json({
          message: 'Friend request rejected and user has been auto-blocked',
        });
      }

      await prisma.friendship.update({
        where: { id: friendRequestId },
        data: {
          status: 'DECLINED',
          declineCount: newDeclineCount,
          declinedAt: new Date(),
        },
      });

      return NextResponse.json({ message: 'Friend request rejected' });
    } else if (action === 'block') {
      // Either party can block
      if (fr.senderId !== userId && fr.receiverId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.friendship.update({
        where: { id: friendRequestId },
        data: {
          status: 'BLOCKED',
          blockedAt: new Date(),
          blockedBy: userId,
        },
      });

      return NextResponse.json({ message: 'User blocked successfully' });
    } else if (action === 'cancel') {
      if (fr.senderId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.friendship.update({
        where: { id: friendRequestId },
        data: { status: 'CANCELLED' },
      });

      return NextResponse.json({ message: 'Friend request canceled' });
    } else if (action === 'remove') {
      // Validate that the current user is part of the request
      if (fr.senderId !== userId && fr.receiverId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.friendship.delete({
        where: { id: friendRequestId },
      });

      return NextResponse.json({ message: 'Friend removed successfully' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[PUT /api/friends/[id]]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
