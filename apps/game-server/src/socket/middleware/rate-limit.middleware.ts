import { logger } from '@workspace/logger';
import { createRateLimiter, slidingWindow } from '@workspace/rate-limit';
import { RateLimitError } from './error.middleware';

const log = logger.child({ module: 'socket:rate-limit' });

/**
 * Per-action sliding-window limiters for socket events. Redis-backed, so limits
 * hold across instances. Wired into `createHandler` (see validation.middleware).
 */
const rateLimiters = {
  // Matchmaking: 1 request per 3 seconds
  MATCHMAKING: createRateLimiter({
    limiter: slidingWindow(1, '3 s'),
    prefix: 'socket:matchmaking',
  }),

  // Game moves: 10 per second
  GAME_MOVE: createRateLimiter({
    limiter: slidingWindow(10, '1 s'),
    prefix: 'socket:game-move',
  }),

  // Challenge creation: 5 per minute
  CHALLENGE_CREATE: createRateLimiter({
    limiter: slidingWindow(5, '60 s'),
    prefix: 'socket:challenge',
  }),

  // Draw offers: 3 per game (10 minute window)
  DRAW_OFFER: createRateLimiter({
    limiter: slidingWindow(3, '600 s'),
    prefix: 'socket:draw-offer',
  }),

  // General actions: 30 per minute
  GENERAL: createRateLimiter({
    limiter: slidingWindow(30, '60 s'),
    prefix: 'socket:general',
  }),
} as const;

export type RateLimitAction = keyof typeof rateLimiters;

/**
 * Enforce a rate limit for the given action and key.
 *
 * Fails open: if the limiter backend (Upstash) is unreachable or errors, the
 * request is allowed through rather than breaking the event — a rate-limiter
 * outage must not take down the feature it guards.
 *
 * @throws RateLimitError only when the limit is actually exceeded
 */
export async function enforceRateLimit(action: RateLimitAction, key: string): Promise<void> {
  let success: boolean;
  try {
    ({ success } = await rateLimiters[action].limit(key));
  } catch (err) {
    log.error({ err, action }, 'rate limiter unavailable, allowing request (fail open)');
    return;
  }

  if (!success) {
    throw new RateLimitError(`Rate limit exceeded for ${action}. Please slow down.`);
  }
}
