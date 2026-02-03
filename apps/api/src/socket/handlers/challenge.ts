import { prisma } from '@workspace/db';
import { parseTimeControl } from '@workspace/utils';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { AuthenticatedSocket, getUserRoomId, TypedServer } from '@workspace/utils/types';
import {
  cancelChallengeExpiration,
  scheduleChallengeExpiration,
} from '../../queues/challenge.queue';
import { createHandler } from '../middleware/validation.middleware';
import {
  ChallengeCreatePayload,
  ChallengeCreateSchema,
  ChallengeResponsePayload,
  ChallengeResponseSchema,
} from '../schemas';

async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        referenceId: userId,
        status: {
          in: ['active', 'trialing'],
        },
      },
    });
    return !!subscription;
  } catch (error) {
    console.error('[Subscription Check] Error checking subscription:', error);
    return false;
  }
}

export function setupChallengeHandlers(io: TypedServer): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.on(
      SOCKET_EVENTS.CREATE_CHALLENGE,
      createHandler(socket, ChallengeCreateSchema, (payload) =>
        handleCreateChallenge(io, socket, payload),
      ),
    );

    socket.on(
      SOCKET_EVENTS.ACCEPT_CHALLENGE,
      createHandler(socket, ChallengeResponseSchema, (payload) =>
        handleAcceptChallenge(io, socket, payload),
      ),
    );

    socket.on(
      SOCKET_EVENTS.DECLINE_CHALLENGE,
      createHandler(socket, ChallengeResponseSchema, (payload) =>
        handleDeclineChallenge(io, socket, payload),
      ),
    );

    socket.on(
      SOCKET_EVENTS.CANCEL_CHALLENGE,
      createHandler(socket, ChallengeResponseSchema, (payload) =>
        handleCancelChallenge(io, socket, payload),
      ),
    );
  });
}

async function handleCreateChallenge(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: ChallengeCreatePayload,
): Promise<void> {
  const { receiverId, timeControl, message } = payload;
  const senderId = socket.data.userId;

  const hasSub = await hasActiveSubscription(senderId);
  if (!hasSub) {
    throw new Error(
      'VALIDATION_ERROR: Challenging players is a Pro feature. Please upgrade your membership to send challenges.',
    );
  }

  // Time control is validated by Zod schema

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, username: true, rating: true },
  });

  if (!receiver) {
    throw new Error('VALIDATION_ERROR: Receiver not found');
  }

  if (senderId === receiverId) {
    throw new Error('VALIDATION_ERROR: Cannot challenge yourself');
  }

  const existingChallenge = await prisma.challenge.findFirst({
    where: {
      OR: [
        { senderId, receiverId, status: 'PENDING' },
        { senderId: receiverId, receiverId: senderId, status: 'PENDING' },
      ],
    },
  });

  if (existingChallenge) {
    throw new Error('VALIDATION_ERROR: A challenge already exists between these players');
  }

  const challenge = await prisma.challenge.create({
    data: {
      senderId,
      receiverId,
      timeControl,
      message: message || null,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  });

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, username: true, rating: true },
  });

  const receiverRoomId = getUserRoomId(receiverId);
  io.to(receiverRoomId).emit(SOCKET_EVENTS.CHALLENGE_RECEIVED, {
    challengeId: challenge.id,
    sender: sender!,
    timeControl,
    message: message || undefined,
    expiresAt: challenge.expiresAt,
  });

  await scheduleChallengeExpiration(challenge.id);
}

async function handleAcceptChallenge(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: ChallengeResponsePayload,
): Promise<void> {
  const { challengeId } = payload;
  const userId = socket.data.userId;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      sender: {
        select: { id: true, username: true, rating: true },
      },
      receiver: {
        select: { id: true, username: true, rating: true },
      },
    },
  });

  if (!challenge) {
    throw new Error('VALIDATION_ERROR: Challenge not found');
  }

  if (challenge.receiverId !== userId) {
    throw new Error('VALIDATION_ERROR: You are not the receiver of this challenge');
  }

  if (challenge.status !== 'PENDING') {
    throw new Error('VALIDATION_ERROR: Challenge is no longer pending');
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'EXPIRED' },
    });
    throw new Error('VALIDATION_ERROR: Challenge has expired');
  }

  const { initialMinutes, incrementSeconds } = parseTimeControl(challenge.timeControl);

  const player1IsWhite = Math.random() < 0.5;
  const whitePlayerId = player1IsWhite ? challenge.senderId : challenge.receiverId;
  const blackPlayerId = player1IsWhite ? challenge.receiverId : challenge.senderId;

  const game = await prisma.game.create({
    data: {
      whitePlayerId,
      blackPlayerId,
      timeControl: challenge.timeControl,
      initialTime: initialMinutes * 60,
      incrementTime: incrementSeconds,
      whiteTimeLeft: initialMinutes * 60 * 1000,
      blackTimeLeft: initialMinutes * 60 * 1000,
      gameType: 'CHALLENGE',
      whiteEloAtStart: player1IsWhite ? challenge.sender.rating : challenge.receiver.rating,
      blackEloAtStart: player1IsWhite ? challenge.receiver.rating : challenge.sender.rating,
      isRanked: true,
    },
  });

  await cancelChallengeExpiration(challengeId);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      status: 'ACCEPTED',
      respondedAt: new Date(),
    },
  });

  const senderIsWhite = challenge.senderId === whitePlayerId;

  io.to(getUserRoomId(challenge.senderId)).emit(SOCKET_EVENTS.CHALLENGE_ACCEPTED, {
    gameId: game.id,
    opponent: challenge.receiver,
    color: senderIsWhite ? 'white' : 'black',
    timeControl: challenge.timeControl,
  });

  io.to(getUserRoomId(challenge.receiverId)).emit(SOCKET_EVENTS.CHALLENGE_ACCEPTED, {
    gameId: game.id,
    opponent: challenge.sender,
    color: senderIsWhite ? 'black' : 'white',
    timeControl: challenge.timeControl,
  });

  console.log(`[Challenge] Challenge ${challengeId} accepted, game ${game.id} created`);
}

async function handleDeclineChallenge(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: ChallengeResponsePayload,
): Promise<void> {
  const { challengeId } = payload;
  const userId = socket.data.userId;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error('VALIDATION_ERROR: Challenge not found');
  }

  if (challenge.receiverId !== userId) {
    throw new Error('VALIDATION_ERROR: You are not the receiver of this challenge');
  }

  if (challenge.status !== 'PENDING') {
    throw new Error('VALIDATION_ERROR: Challenge is no longer pending');
  }

  await cancelChallengeExpiration(challengeId);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
    },
  });

  io.to(getUserRoomId(challenge.senderId)).emit(SOCKET_EVENTS.CHALLENGE_DECLINED);
  io.to(getUserRoomId(challenge.receiverId)).emit(SOCKET_EVENTS.CHALLENGE_DECLINED);

  console.log(`[Challenge] Challenge ${challengeId} declined`);
}

async function handleCancelChallenge(
  io: TypedServer,
  socket: AuthenticatedSocket,
  payload: ChallengeResponsePayload,
): Promise<void> {
  const { challengeId } = payload;
  const userId = socket.data.userId;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error('VALIDATION_ERROR: Challenge not found');
  }

  if (challenge.senderId !== userId) {
    throw new Error('VALIDATION_ERROR: You are not the sender of this challenge');
  }

  if (challenge.status !== 'PENDING') {
    throw new Error('VALIDATION_ERROR: Challenge is no longer pending');
  }

  await cancelChallengeExpiration(challengeId);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      status: 'CANCELLED',
      respondedAt: new Date(),
    },
  });

  io.to(getUserRoomId(challenge.senderId)).emit(SOCKET_EVENTS.CHALLENGE_CANCELLED);
  io.to(getUserRoomId(challenge.receiverId)).emit(SOCKET_EVENTS.CHALLENGE_CANCELLED);

  console.log(`[Challenge] Challenge ${challengeId} cancelled`);
}
