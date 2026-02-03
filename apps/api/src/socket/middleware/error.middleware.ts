import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { AuthenticatedSocket, SocketError } from '@workspace/utils/types';
import { Socket } from 'socket.io';

export const errorHandler =
  <T>(socket: Socket, handler: (...args: T[]) => Promise<void> | void) =>
  async (...args: T[]) => {
    try {
      await handler(...args);
    } catch (error) {
      // Validate socket before using
      if (!socket || typeof socket.emit !== 'function' || typeof socket.on !== 'function') {
        console.error('[Socket Error] Invalid socket instance passed to errorHandler:', socket);
        return;
      }
      handleSocketError(socket, error);
    }
  };

export const handleSocketError = (socket: Socket, error: unknown): void => {
  console.error('[Socket Error]', error);

  let socketError: SocketError;

  if (error instanceof Error) {
    // Parse custom error types
    if (error.message.startsWith('AUTHENTICATION_ERROR:')) {
      socketError = {
        code: 'AUTHENTICATION_ERROR',
        message: error.message.replace('AUTHENTICATION_ERROR:', '').trim(),
      };
      socket.emit(SOCKET_EVENTS.AUTHENTICATION_ERROR, socketError);
    } else if (error.message.startsWith('VALIDATION_ERROR:')) {
      socketError = {
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION_ERROR:', '').trim(),
      };
      socket.emit(SOCKET_EVENTS.VALIDATION_ERROR, socketError);
    } else if (error.message.startsWith('GAME_ERROR:')) {
      socketError = {
        code: 'GAME_ERROR',
        message: error.message.replace('GAME_ERROR:', '').trim(),
      };
      socket.emit(SOCKET_EVENTS.GAME_ERROR, socketError);
    } else if (error.message.startsWith('MATCHMAKING_ERROR:')) {
      socketError = {
        code: 'MATCHMAKING_ERROR',
        message: error.message.replace('MATCHMAKING_ERROR:', '').trim(),
      };
      socket.emit(SOCKET_EVENTS.MATCHMAKING_ERROR, socketError);
    } else if (error.message.startsWith('RATE_LIMIT_ERROR:')) {
      socketError = {
        code: 'RATE_LIMIT_ERROR',
        message: error.message.replace('RATE_LIMIT_ERROR:', '').trim(),
      };
      socket.emit(SOCKET_EVENTS.RATE_LIMIT_ERROR, socketError);
    } else {
      // Generic error
      socketError = {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, socketError);
    }
  } else {
    // Unknown error type
    socketError = {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
    socket.emit(SOCKET_EVENTS.SERVER_ERROR, socketError);
  }
};

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(`AUTHENTICATION_ERROR: ${message}`);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(`VALIDATION_ERROR: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class GameError extends Error {
  public gameId?: string;

  constructor(message: string, gameId?: string) {
    super(`GAME_ERROR: ${message}`);
    this.name = 'GameError';
    this.gameId = gameId;
  }
}

export class MatchmakingError extends Error {
  constructor(message: string) {
    super(`MATCHMAKING_ERROR: ${message}`);
    this.name = 'MatchmakingError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded. Please slow down.') {
    super(`RATE_LIMIT_ERROR: ${message}`);
    this.name = 'RateLimitError';
  }
}

export const asyncHandler = <T>(
  socket: AuthenticatedSocket,
  fn: (...args: T[]) => Promise<void>,
): ((...args: T[]) => Promise<void>) => {
  return async (...args: T[]): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      if (!socket || typeof socket.emit !== 'function' || typeof socket.on !== 'function') {
        console.error('[Socket Error] Could not identify socket instance:', socket);
        return;
      }
      handleSocketError(socket, error);
    }
  };
};
