import { PieceSymbol } from 'chess.js';
import { Server, Socket } from 'socket.io';
import { Color, GameStatus, GameTerminationReason, Winner } from './chess';

// ========================================
// SOCKET DATA TYPES
// ========================================

/**
 * Data attached to each socket connection after authentication
 */
export interface SocketData {
  id: string;
  userId: string;
  username: string;
  image: string | null;
  rating: number;
  sessionId: string;
  connectedAt: Date;
  lastPingAt?: Date;
}

/**
 * Extended Socket type with our custom data
 */
export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Extended Server type
 */
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

// ========================================
// MATCHMAKING TYPES
// ========================================

export interface FindMatchPayload {
  timeControl: string; // e.g., "10+0", "5+3"
  ratingRange?: number; // Optional: max rating difference (default: 200)
}

export interface MatchFoundPayload {
  gameId: string;
  opponent: {
    id: string;
    username: string;
    image: string | null;
    rating: number;
  };
  color: 'white' | 'black';
  timeControl: string;
  initialTime: number; // in seconds
  incrementTime: number; // in seconds
}

export interface QueueStatusPayload {
  position: number;
  estimatedWaitTime: number; // in seconds
  playersInQueue: number;
}

// ========================================
// GAME TYPES
// ========================================

export interface GameState {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePlayer: {
    id: string;
    name: string;
    username: string;
    image: string | null;
    rating: number;
  };
  blackPlayer: {
    id: string;
    name: string;
    username: string;
    image: string | null;
    rating: number;
  };
  status: GameStatus;
  currentFen: string;
  moves: MoveData[];
  whiteTimeLeft: number; // in milliseconds
  blackTimeLeft: number; // in milliseconds
  currentTurn: Color;
  timeControl: string;
  initialTime: number;
  incrementTime: number;
  startedAt: number;
  lastMoveAt?: number;
}

export interface MoveData {
  moveNumber: number;
  color: Color;
  from: string;
  to: string;
  piece: string;
  captured: PieceSymbol | null;
  promotion: PieceSymbol | null;
  san: string; // Standard Algebraic Notation
  lan: string; // Long Algebraic Notation
  fenBefore: string;
  fenAfter: string;
  createdAt: Date;
  timeSpent: number | null; // milliseconds spent on this move
  timeLeft: number | null; // milliseconds remaining after move
}

export interface MakeMovePayload {
  gameId: string;
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface MoveAcceptedPayload {
  move: MoveData;
  gameState: {
    currentFen: string;
    currentTurn: Color;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    moveNumber: number;
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
  };
}

export interface OpponentMovedPayload {
  move: MoveData;
  gameState: {
    currentFen: string;
    currentTurn: Color;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    moveNumber: number;
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
  };
}

export interface GameSyncPayload {
  game: GameState;
  yourColor: 'w' | 'b';
  canMove: boolean;
}

export interface GameEndedPayload {
  gameId: string;
  winner: Winner;
  reason: GameTerminationReason;
  finalFen: string;
  eloChanges: {
    white: number;
    black: number;
  };
  newRatings: {
    white: number;
    black: number;
  };
  pgn: string;
}

export interface JoinGamePayload {
  gameId: string;
}

// ========================================
// CHALLENGE TYPES
// ========================================

export interface CreateChallengePayload {
  receiverId: string;
  timeControl: string;
  message?: string;
}

export interface ChallengeReceivedPayload {
  challengeId: string;
  sender: {
    id: string;
    username: string;
    rating: number;
  };
  timeControl: string;
  message?: string;
  expiresAt: Date;
}

export interface AcceptChallengePayload {
  challengeId: string;
}

export interface ChallengeAcceptedPayload {
  gameId: string;
  opponent: {
    id: string;
    username: string;
    rating: number;
  };
  color: 'white' | 'black';
  timeControl: string;
}

// ========================================
// CONNECTION TYPES
// ========================================

export interface UserAuthenticatedPayload {
  userId: string;
  username: string;
  rating: number;
}

export interface ActiveGameFoundPayload {
  gameId: string;
  status: GameStatus;
}

export interface PingCheckPayload {
  timestamp: number;
}

export interface PongResponsePayload {
  timestamp: number;
  latency: number; // in milliseconds
}

// ========================================
// ERROR TYPES
// ========================================

export interface SocketError {
  code: string;
  message: string;
}

export interface ValidationError extends SocketError {
  code: 'VALIDATION_ERROR';
  field?: string;
}

export interface AuthenticationError extends SocketError {
  code: 'AUTHENTICATION_ERROR';
}

export interface GameError extends SocketError {
  code: 'GAME_ERROR';
  gameId?: string;
}

export interface MatchmakingError extends SocketError {
  code: 'MATCHMAKING_ERROR';
}

// ========================================
// EVENT PAYLOAD MAPS
// ========================================

/**
 * Events sent from client to server
 */
export interface ClientToServerEvents {
  // Connection
  'ping:check': (payload: PingCheckPayload) => void;

  // Matchmaking
  'matchmaking:find': (payload: FindMatchPayload) => void;
  'matchmaking:cancel': () => void;

  // Game
  'game:join': (payload: JoinGamePayload) => void;
  'game:leave': (payload: { gameId: string }) => void;
  'game:player_ready': (payload: { gameId: string }) => void;
  'game:move': (payload: MakeMovePayload) => void;
  'game:resign': (payload: { gameId: string }) => void;
  'game:draw_offer': (payload: { gameId: string }) => void;
  'game:draw_accept': (payload: { gameId: string }) => void;
  'game:draw_decline': (payload: { gameId: string }) => void;
  'game:abort': (payload: { gameId: string }) => void;

  // Challenges
  'challenge:create': (payload: CreateChallengePayload) => void;
  'challenge:accept': (payload: AcceptChallengePayload) => void;
  'challenge:decline': (payload: { challengeId: string }) => void;
  'challenge:cancel': (payload: { challengeId: string }) => void;
}

/**
 * Events sent from server to client
 */
export interface ServerToClientEvents {
  // Connection
  'user:authenticated': (payload: UserAuthenticatedPayload) => void;
  'connection:active_game_found': (payload: ActiveGameFoundPayload) => void;
  'ping:response': (payload: PongResponsePayload) => void;

  // Matchmaking
  'matchmaking:match_found': (payload: MatchFoundPayload) => void;
  'matchmaking:cancelled': () => void;
  'matchmaking:queue_status': (payload: QueueStatusPayload) => void;
  'matchmaking:error': (error: MatchmakingError) => void;

  // Game
  'game:started': (payload: GameSyncPayload) => void;
  'game:waiting_for_opponent': () => void;
  'game:sync': (payload: GameSyncPayload) => void;
  'game:move_accepted': (payload: MoveAcceptedPayload) => void;
  'game:opponent_moved': (payload: OpponentMovedPayload) => void;
  'game:invalid_move': (error: GameError) => void;
  'game:ended': (payload: GameEndedPayload) => void;
  'game:draw_offer': () => void;
  'game:draw_declined': () => void;
  'game:error': (error: GameError) => void;

  // Challenges
  'challenge:received': (payload: ChallengeReceivedPayload) => void;
  'challenge:accepted': (payload: ChallengeAcceptedPayload) => void;
  'challenge:declined': () => void;
  'challenge:cancelled': () => void;
  'challenge:expired': (payload: { challengeId: string }) => void;

  // Errors
  'error:authentication': (error: AuthenticationError) => void;
  'error:validation': (error: ValidationError) => void;
  'error:server': (error: SocketError) => void;
  'error:rate_limit': (error: SocketError) => void;
}

// ========================================
// INTERNAL SERVICE TYPES
// ========================================

/**
 * Matchmaking queue entry
 */
export interface QueueEntry {
  userId: string;
  username: string;
  rating: number;
  image: string | null;
  timeControl: string;
  ratingRange: number;
  joinedAt: Date;
  socketId: string;
}

/**
 * Active game cache entry
 */
export interface ActiveGameCache {
  gameId: string;
  whitePlayerId: string;
  blackPlayerId: string;
  status: GameStatus;
  currentFen: string;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentTurn: Color;
  lastMoveAt: number;
  whiteSocketId?: string;
  blackSocketId?: string;
}

/**
 * Room naming convention
 */
export enum RoomPrefix {
  GAME = 'game:',
  USER = 'user:',
  SPECTATE = 'spectate:',
}

/**
 * Get game room ID
 */
export const getGameRoomId = (gameId: string): string => {
  return `${RoomPrefix.GAME}${gameId}`;
};

/**
 * Get user room ID (for direct messages)
 */
export const getUserRoomId = (userId: string): string => {
  return `${RoomPrefix.USER}${userId}`;
};

/**
 * Get spectator room ID
 */
export const getSpectateRoomId = (gameId: string): string => {
  return `${RoomPrefix.SPECTATE}${gameId}`;
};
