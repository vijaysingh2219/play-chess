import { AuthenticatedSocket } from '@workspace/contracts';
import { z } from 'zod';
import { AppSocketError, handleSocketError } from './error.middleware';
import { enforceRateLimit, type RateLimitAction } from './rate-limit.middleware';

/**
 * Opt-in rate limiting for a handler. When `perGame` is set the limit is keyed
 * per game (uses the payload's `gameId`); otherwise it is keyed per user.
 */
export interface RateLimitConfig {
  action: RateLimitAction;
  perGame?: boolean;
}

/**
 * Validation error class for socket events
 */
export class SocketValidationError extends AppSocketError {
  readonly code = 'VALIDATION_ERROR';
  readonly validationErrors: z.ZodError;

  constructor(message: string, errors: z.ZodError) {
    super(message);
    this.name = 'SocketValidationError';
    this.validationErrors = errors;
  }
}

/**
 * Validate a payload against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param payload - The payload to validate
 * @returns The validated and typed payload
 * @throws SocketValidationError if validation fails
 */
export function validatePayload<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new SocketValidationError(errorMessage, result.error);
  }

  return result.data;
}

/**
 * Create a type-safe socket event handler with built-in validation and error handling
 *
 * This is the recommended way to create socket handlers. It combines:
 * - Zod schema validation with automatic type inference
 * - Async error handling with proper error emission
 *
 * @param socket - The authenticated socket instance
 * @param schema - Zod schema for payload validation (type is inferred automatically)
 * @param handler - The handler function receiving the validated & typed payload
 * @param rateLimit - Optional rate limit applied (after validation) before the handler runs
 * @returns A wrapped handler ready to use with socket.on()
 *
 * @example
 * ```typescript
 * socket.on(
 *   SOCKET_EVENTS.MAKE_MOVE,
 *   createHandler(
 *     socket,
 *     MakeMoveSchema,
 *     (payload) => handleMakeMove(io, socket, payload),
 *     { action: 'GAME_MOVE', perGame: true },
 *   ),
 * );
 * ```
 */
export function createHandler<T extends z.ZodSchema>(
  socket: AuthenticatedSocket,
  schema: T,
  handler: (payload: z.infer<T>) => Promise<void>,
  rateLimit?: RateLimitConfig,
): (rawPayload: unknown) => Promise<void> {
  return async (rawPayload: unknown) => {
    try {
      const validated = validatePayload(schema as z.ZodSchema<z.infer<T>>, rawPayload);

      if (rateLimit) {
        const userId = socket.data.userId;
        const gameId = rateLimit.perGame ? (validated as { gameId?: string }).gameId : undefined;
        const key = gameId
          ? `${userId}:${gameId}:${rateLimit.action}`
          : `${userId}:${rateLimit.action}`;
        await enforceRateLimit(rateLimit.action, key);
      }

      await handler(validated as z.infer<T>);
    } catch (error) {
      handleSocketError(socket, error);
    }
  };
}
