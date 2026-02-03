import { Socket } from 'socket.io';

// Re-export all chess types from @workspace/chess for backwards compatibility
export {
  // Constants
  PIECE_VALUES,
  STARTING_FEN,
  // Broadcast type
  type BroadcastPayload,
  type CapturedPieces,
  type CapturedPieceSymbol,
  // Challenge types
  type ChallengeCreatePayload,
  type ChallengeStatus,
  type Color,
  type DrawResponse,
  type GameErrorPayload,
  // Payload types
  type GameInitPayload,
  type GameMove,
  type GameMovePayload,
  type GameMoveSuccessPayload,
  type GameOverPayload,
  type GameResult,
  type GameStateSyncPayload,
  // Core types
  type GameStatus,
  type GameTerminationReason,
  type GameType,
  // Move & game state types
  type Move,
  type OpponentDisconnectedPayload,
  // Player types
  type PlayerStats,
  type PromotionPiece,
  // Queue types
  type QueueJoinPayload,
  type QueueJoinSuccessPayload,
  type QueueLeavePayload,
  type TimerState,
  type Winner,
} from '@workspace/chess/types';

// ============================================================================
// Socket-specific Types (require socket.io dependency)
// ============================================================================

/**
 * Player info with socket connection
 */
export interface PlayerInfo {
  userId: string;
  username: string;
  socket: Socket;
}

/**
 * Server statistics
 */
export interface ServerStats {
  server: {
    timestamp: string;
    uptime: number;
  };
  players: {
    totalPlayers: number;
    totalSockets: number;
  };
  games: {
    activeGames: number;
    activePlayers: number;
  };
  queues: {
    totalQueues: number;
    totalPlayers: number;
    queueStates: Record<string, { count: number; players: string[]; waitTimes: number[] }>;
  };
}

/**
 * Socket authentication data
 */
export interface SocketAuth {
  userId: string;
  username: string;
  token?: string;
}

/**
 * Typed socket for chess connections
 */
export type ChessSocket = Socket<SocketAuth>;
