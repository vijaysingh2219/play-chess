import { z } from 'zod';

/**
 * Schema for ping check events
 */
export const PingCheckSchema = z.object({
  timestamp: z.number(),
});

/**
 * Empty schema for events with no payload
 */
export const EmptySchema = z.object({}).optional();

export type PingCheckPayload = z.infer<typeof PingCheckSchema>;
