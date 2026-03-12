import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const blockUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json();
  const parsed = blockUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { userId: targetUserId } = parsed.data;
  const blockerId = session.user.id;

  if (targetUserId === blockerId) {
    return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
  }

  try {
    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for existing friendship in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: blockerId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: blockerId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        return NextResponse.json({ message: 'User is already blocked' });
      }

      await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          status: 'BLOCKED',
          blockedAt: new Date(),
          blockedBy: blockerId,
        },
      });

      return NextResponse.json({ message: 'User blocked successfully' });
    }

    // No existing friendship — create one with BLOCKED status
    await prisma.friendship.create({
      data: {
        senderId: blockerId,
        receiverId: targetUserId,
        status: 'BLOCKED',
        blockedAt: new Date(),
        blockedBy: blockerId,
      },
    });

    return NextResponse.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('[POST /api/friends/block]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
