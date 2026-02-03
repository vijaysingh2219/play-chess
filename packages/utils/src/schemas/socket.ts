import { z } from 'zod';

export const QueueJoinSchema = z.object({
  timer: z.number().min(1),
  increment: z.number().min(0).optional(),
});

export const QueueLeaveSchema = z.object({
  userId: z.string().min(1),
});

export const QueueLeaveStatusSchema = z.object({
  success: z.boolean(),
  reason: z.string().optional(),
});

export const GameMoveSchema = z.object({
  gameId: z.string().uuid(),
  move: z.string().min(2),
});

export const GameResignSchema = z.object({
  gameId: z.string().uuid(),
});

export const DrawOfferSchema = z.object({
  userId: z.string().min(1),
});

export const DrawResponseSchema = z.object({
  userId: z.string().min(1),
  accepted: z.boolean(),
});

export const ChallengeCreateSchema = z.object({
  opponentId: z.string().min(1),
  timer: z.number().min(1),
  increment: z.number().min(0),
});

export const ChallengeAcceptSchema = z.object({
  challengeId: z.string().uuid(),
  userId: z.string().min(1),
  username: z.string().min(1),
});

export const ChallengeDeclineSchema = z.object({
  challengeId: z.string().uuid(),
  username: z.string().min(1),
});
