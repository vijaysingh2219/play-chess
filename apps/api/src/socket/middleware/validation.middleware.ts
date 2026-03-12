import { AuthenticatedSocket } from '@workspace/utils/types';
import { z } from 'zod';
import { handleSocketError } from './error.middleware';

/**
 * Validation error class for socket events
 */
export class SocketValidationError extends Error {
  public readonly validationErrors: z.ZodError;

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

    throw new SocketValidationError(`VALIDATION_ERROR: ${errorMessage}`, result.error);
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
 * @returns A wrapped handler ready to use with socket.on()
 *
 * @example
 * ```typescript
 * socket.on(
 *   SOCKET_EVENTS.JOIN_GAME,
 *   createHandler(socket, JoinGameSchema, async (payload) => {
 *     // payload is automatically typed as { gameId: string }
 *     await handleJoinGame(io, socket, payload);
 *   }),
 * );
 * ```
 */
export function createHandler<T extends z.ZodSchema>(
  socket: AuthenticatedSocket,
  schema: T,
  handler: (payload: z.infer<T>) => Promise<void>,
): (rawPayload: unknown) => Promise<void> {
  return async (rawPayload: unknown) => {
    try {
      const validated = validatePayload(schema as z.ZodSchema<z.infer<T>>, rawPayload);
      await handler(validated as z.infer<T>);
    } catch (error) {
      handleSocketError(socket, error);
    }
  };
}

/**
 * Create a validated handler wrapper (without error handling)
 *
 * Use this when you need validation only and handle errors separately.
 * For most cases, prefer `createHandler` which includes error handling.
 *
 * @param schema - Zod schema to validate the payload
 * @param handler - The handler function to wrap
 * @returns A wrapped handler that validates input before execution
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (payload: T) => Promise<void>,
): (rawPayload: unknown) => Promise<void> {
  return async (rawPayload: unknown) => {
    const validatedPayload = validatePayload(schema, rawPayload);
    await handler(validatedPayload);
  };
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: unknown): error is SocketValidationError {
  return error instanceof SocketValidationError;
}
