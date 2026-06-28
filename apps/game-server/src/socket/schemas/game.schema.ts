import { z } from 'zod';

/**
 * Schema for game ID only payloads
 */
export const GameIdSchema = z.object({
  gameId: z.string().uuid('Invalid game ID format'),
});

/**
 * Schema for join game events
 */
export const JoinGameSchema = z.object({
  gameId: z.string().uuid('Invalid game ID format'),
});

/**
 * Schema for make move events
 */
export const MakeMoveSchema = z.object({
  gameId: z.string().uuid('Invalid game ID format'),
  from: z.string().regex(/^[a-h][1-8]$/, 'Invalid square format'),
  to: z.string().regex(/^[a-h][1-8]$/, 'Invalid square format'),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});

export type GameIdPayload = z.infer<typeof GameIdSchema>;
export type JoinGamePayload = z.infer<typeof JoinGameSchema>;
export type MakeMovePayload = z.infer<typeof MakeMoveSchema>;
