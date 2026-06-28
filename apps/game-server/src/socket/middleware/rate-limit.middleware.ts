import { createRateLimiter, slidingWindow } from '@workspace/rate-limit';
import { Socket } from 'socket.io';
import { RateLimitError } from './error.middleware';

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

type RateLimitAction = keyof typeof rateLimiters;

export const createRateLimitMiddleware = <T = unknown>(
  action: RateLimitAction,
  getKey?: (socket: Socket, ...args: T[]) => string,
) => {
  return (handler: (...args: [Socket, ...T[]]) => Promise<void> | void) => {
    return async (...args: [Socket, ...T[]]) => {
      const socket = args[0];
      const userId = (socket as { data?: { userId?: string } }).data?.userId;

      if (!userId) {
        throw new RateLimitError('User not authenticated');
      }

      // Generate rate limit key
      const key = getKey ? getKey(socket, ...(args.slice(1) as T[])) : `${userId}:${action}`;

      // Check rate limit
      const limiter = rateLimiters[action];
      const { success } = await limiter.limit(key);

      if (!success) {
        throw new RateLimitError(`Rate limit exceeded for ${action}. Please slow down.`);
      }

      return handler(...args);
    };
  };
};

export const createGameRateLimitMiddleware = <T extends { gameId?: string } = { gameId?: string }>(
  action: RateLimitAction,
) => {
  return createRateLimitMiddleware<T>(action, (socket, payload) => {
    const userId = (socket as { data?: { userId?: string } }).data?.userId;
    const gameId = payload?.gameId;
    return `${userId}:${gameId}:${action}`;
  });
};

export const rateLimitMatchmaking = createRateLimitMiddleware('MATCHMAKING');
export const rateLimitGameMove = createGameRateLimitMiddleware('GAME_MOVE');
export const rateLimitChallengeCreate = createRateLimitMiddleware('CHALLENGE_CREATE');
export const rateLimitDrawOffer = createGameRateLimitMiddleware('DRAW_OFFER');
