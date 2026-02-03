import { auth } from '@workspace/auth/server';
import { prisma } from '@workspace/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface FriendRequestSent {
  id: string;
  createdAt: Date;
  receiver: {
    username: string;
    id: string;
    image: string | null;
    name: string | null;
    rating: number;
    createdAt: Date;
  };
}

interface FriendRequestReceived {
  id: string;
  createdAt: Date;
  sender: {
    username: string;
    id: string;
    image: string | null;
    name: string | null;
    rating: number;
    createdAt: Date;
  };
}

const getFriendsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  type: z.enum(['friend', 'sent', 'received']).optional().default('friend'),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']).optional().default('ACCEPTED'),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queryParams = {
    id: searchParams.get('id') ?? '',
    type: searchParams.get('type') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  };

  const parsed = getFriendsSchema.safeParse(queryParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { id, type, status } = parsed.data;

  if (['PENDING', 'DECLINED', 'CANCELLED'].includes(status) && session.user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (type === 'sent') {
      const sentRequests = await prisma.friendship.findMany({
        where: {
          senderId: id,
          status,
        },
        select: {
          id: true,
          createdAt: true,
          receiver: {
            select: {
              id: true,
              name: true,
              username: true,
              rating: true,
              createdAt: true,
              image: true,
            },
          },
        },
      });

      return NextResponse.json({
        type,
        status,
        data: sentRequests,
      });
    }

    if (type === 'received') {
      const receivedRequests = await prisma.friendship.findMany({
        where: {
          receiverId: id,
          status,
        },
        select: {
          id: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              rating: true,
              createdAt: true,
              image: true,
            },
          },
        },
      });

      return NextResponse.json({
        type,
        status,
        data: receivedRequests,
      });
    }

    if (type === 'friend') {
      // Only accepted friendships
      const user = await prisma.user.findUnique({
        where: { id: id },
        select: {
          friendRequestsSent: {
            where: { status: 'ACCEPTED' },
            select: {
              id: true,
              createdAt: true,
              receiver: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  rating: true,
                  createdAt: true,
                  image: true,
                },
              },
            },
          },
          friendRequestsReceived: {
            where: { status: 'ACCEPTED' },
            select: {
              id: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  rating: true,
                  createdAt: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const friends = [
        ...user.friendRequestsSent.map((req: FriendRequestSent) => ({
          user: {
            id: req.receiver.id,
            name: req.receiver.name,
            username: req.receiver.username,
            rating: req.receiver.rating,
            createdAt: req.receiver.createdAt,
            image: req.receiver.image,
          },
          id: req.id,
          createdAt: req.createdAt,
        })),
        ...user.friendRequestsReceived.map((req: FriendRequestReceived) => ({
          user: {
            id: req.sender.id,
            name: req.sender.name,
            username: req.sender.username,
            rating: req.sender.rating,
            createdAt: req.sender.createdAt,
            image: req.sender.image,
          },
          id: req.id,
          createdAt: req.createdAt,
        })),
      ];

      return NextResponse.json({
        type,
        status: 'ACCEPTED',
        data: friends,
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('[GET /api/friends]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const friendRequestSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json();
  const parsed = friendRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(', ') },
      { status: 400 },
    );
  }

  const { identifier } = parsed.data;
  const senderId = session.user.id;

  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === senderId) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
    }

    // Check for existing request in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: senderId },
        ],
        status: {
          in: ['PENDING', 'ACCEPTED'], // Avoid duplicates
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 400 });
    }

    const newRequest = await prisma.friendship.create({
      data: {
        senderId,
        receiverId: targetUser.id,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      message: 'Friend request sent',
      request: newRequest,
    });
  } catch (error) {
    console.error('[POST /api/friends]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
