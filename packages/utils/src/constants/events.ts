/**
 * Socket.IO Event Constants
 *
 * Centralized event names to avoid magic strings and enable type safety.
 * Organized by feature domain.
 */

// ========================================
// CONNECTION EVENTS
// ========================================
export const CONNECTION_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  USER_AUTHENTICATED: 'user:authenticated',
  PING_CHECK: 'ping:check',
  PONG_RESPONSE: 'ping:response',
  ACTIVE_GAME_FOUND: 'connection:active_game_found',
} as const;

// ========================================
// MATCHMAKING EVENTS
// ========================================
export const MATCHMAKING_EVENTS = {
  FIND_MATCH: 'matchmaking:find',
  CANCEL_MATCHMAKING: 'matchmaking:cancel',
  MATCHMAKING_CANCELLED: 'matchmaking:cancelled',
  MATCH_FOUND: 'matchmaking:match_found',
  MATCHMAKING_ERROR: 'matchmaking:error',
  QUEUE_STATUS: 'matchmaking:queue_status',
} as const;

// ========================================
// GAME ROOM EVENTS
// ========================================
export const GAME_EVENTS = {
  JOIN_GAME: 'game:join',
  LEAVE_GAME: 'game:leave',
  GAME_STARTED: 'game:started',
  PLAYER_READY: 'game:player_ready',
  WAITING_FOR_OPPONENT: 'game:waiting_for_opponent',
  GAME_SYNC: 'game:sync',
  MAKE_MOVE: 'game:move',
  MOVE_ACCEPTED: 'game:move_accepted',
  OPPONENT_MOVED: 'game:opponent_moved',
  INVALID_MOVE: 'game:invalid_move',
  GAME_ENDED: 'game:ended',
  GAME_ERROR: 'game:error',
} as const;

// ========================================
// GAME TERMINATION EVENTS
// ========================================
export const TERMINATION_EVENTS = {
  RESIGN: 'game:resign',
  DRAW_OFFER: 'game:draw_offer',
  DRAW_ACCEPT: 'game:draw_accept',
  DRAW_DECLINE: 'game:draw_decline',
  DRAW_DECLINED: 'game:draw_declined',
  ABORT: 'game:abort',
} as const;

// ========================================
// CHALLENGE EVENTS
// ========================================
export const CHALLENGE_EVENTS = {
  CREATE_CHALLENGE: 'challenge:create',
  ACCEPT_CHALLENGE: 'challenge:accept',
  DECLINE_CHALLENGE: 'challenge:decline',
  CANCEL_CHALLENGE: 'challenge:cancel',
  CHALLENGE_RECEIVED: 'challenge:received',
  CHALLENGE_ACCEPTED: 'challenge:accepted',
  CHALLENGE_DECLINED: 'challenge:declined',
  CHALLENGE_CANCELLED: 'challenge:cancelled',
  CHALLENGE_EXPIRED: 'challenge:expired',
} as const;

// ========================================
// ERROR EVENTS
// ========================================
export const ERROR_EVENTS = {
  AUTHENTICATION_ERROR: 'error:authentication',
  VALIDATION_ERROR: 'error:validation',
  SERVER_ERROR: 'error:server',
  RATE_LIMIT_ERROR: 'error:rate_limit',
} as const;

// Export all events as a single object
export const SOCKET_EVENTS = {
  ...CONNECTION_EVENTS,
  ...MATCHMAKING_EVENTS,
  ...GAME_EVENTS,
  ...TERMINATION_EVENTS,
  ...CHALLENGE_EVENTS,
  ...ERROR_EVENTS,
} as const;

// Type helper to ensure event names are from our constants
export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
