import { z } from 'zod';

/**
 * Schema for find match events
 */
export const FindMatchSchema = z.object({
  timeControl: z
    .string()
    .regex(/^\d+\+\d+$/, 'Invalid time control format. Use format like "10+0" or "5+3"'),
  ratingRange: z.number().min(50).max(1000).optional(),
});

export type FindMatchPayload = z.infer<typeof FindMatchSchema>;
