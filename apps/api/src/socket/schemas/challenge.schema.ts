import { z } from 'zod';

/**
 * Schema for challenge create events
 */
export const ChallengeCreateSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required'),
  timeControl: z.string().regex(/^\d+\+\d+$/, 'Invalid time control format'),
  message: z.string().max(200).optional(),
});

/**
 * Schema for challenge response events (accept/decline/cancel)
 */
export const ChallengeResponseSchema = z.object({
  challengeId: z.string().uuid('Invalid challenge ID format'),
});

export type ChallengeCreatePayload = z.infer<typeof ChallengeCreateSchema>;
export type ChallengeResponsePayload = z.infer<typeof ChallengeResponseSchema>;
