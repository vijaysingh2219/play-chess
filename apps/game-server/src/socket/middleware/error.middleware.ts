import { AuthenticatedSocket } from '@workspace/contracts';
import { logger } from '@workspace/logger';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { Socket } from 'socket.io';

const log = logger.child({ module: 'socket:error' });

export type SocketErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'GAME_ERROR'
  | 'MATCHMAKING_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'SERVER_ERROR';

/** Maps an error code to the client event it is emitted on. */
const ERROR_EVENT_BY_CODE = {
  AUTHENTICATION_ERROR: SOCKET_EVENTS.AUTHENTICATION_ERROR,
  VALIDATION_ERROR: SOCKET_EVENTS.VALIDATION_ERROR,
  GAME_ERROR: SOCKET_EVENTS.GAME_ERROR,
  MATCHMAKING_ERROR: SOCKET_EVENTS.MATCHMAKING_ERROR,
  RATE_LIMIT_ERROR: SOCKET_EVENTS.RATE_LIMIT_ERROR,
  SERVER_ERROR: SOCKET_EVENTS.SERVER_ERROR,
} as const satisfies Record<SocketErrorCode, string>;

/**
 * Base class for all socket errors. Carries a machine-readable `code` so the
 * error can be routed to the right client event without parsing messages.
 */
export abstract class AppSocketError extends Error {
  abstract readonly code: SocketErrorCode;
}

export class AuthenticationError extends AppSocketError {
  readonly code = 'AUTHENTICATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppSocketError {
  readonly code = 'VALIDATION_ERROR';
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class GameError extends AppSocketError {
  readonly code = 'GAME_ERROR';
  readonly gameId?: string;

  constructor(message: string, gameId?: string) {
    super(message);
    this.name = 'GameError';
    this.gameId = gameId;
  }
}

export class MatchmakingError extends AppSocketError {
  readonly code = 'MATCHMAKING_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'MatchmakingError';
  }
}

export class RateLimitError extends AppSocketError {
  readonly code = 'RATE_LIMIT_ERROR';

  constructor(message = 'Rate limit exceeded. Please slow down.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Normalize any thrown value into a client-safe { code, message } pair. */
function toSocketError(error: unknown): { code: SocketErrorCode; message: string } {
  if (error instanceof AppSocketError) {
    return { code: error.code, message: error.message };
  }

  // Unknown/unexpected errors are not surfaced verbatim to avoid leaking internals.
  return { code: 'SERVER_ERROR', message: 'An unexpected error occurred' };
}

export const handleSocketError = (socket: Socket, error: unknown): void => {
  (socket.data?.log ?? log).error({ err: error }, 'socket handler error');

  const socketError = toSocketError(error);
  socket.emit(ERROR_EVENT_BY_CODE[socketError.code], socketError);
};

export const asyncHandler = <T>(
  socket: AuthenticatedSocket,
  fn: (...args: T[]) => Promise<void>,
): ((...args: T[]) => Promise<void>) => {
  return async (...args: T[]): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      if (!socket || typeof socket.emit !== 'function' || typeof socket.on !== 'function') {
        log.error('could not identify socket instance');
        return;
      }
      handleSocketError(socket, error);
    }
  };
};
