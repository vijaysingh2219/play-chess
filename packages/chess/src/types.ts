/**
 * Chess-specific type definitions
 *
 * This module contains types related to chess game mechanics,
 * board state, and move handling. This is the source of truth
 * for all chess-related types in the monorepo.
 */

// ============================================================================
// Core Chess Types
// ============================================================================

export type GameStatus = 'ONGOING' | 'COMPLETED' | 'ABANDONED' | 'ABORTED';

export type GameType = 'QUICK_MATCH' | 'CHALLENGE';

export type GameTerminationReason =
  | 'CHECKMATE'
  | 'STALEMATE'
  | 'TIMEOUT'
  | 'RESIGNATION'
  | 'AGREEMENT'
  | 'INSUFFICIENT_MATERIAL'
  | 'THREEFOLD_REPETITION'
  | 'FIFTY_MOVE_RULE'
  | 'DISCONNECTION';

export type Winner = 'WHITE' | 'BLACK' | 'DRAW';

export type Color = 'w' | 'b';

export type GameResult = 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW';

export type CapturedPieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

// ============================================================================
// Move & Game State Types
// ============================================================================

export interface Move {
  color: Color;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  san: string;
  lan: string;
  fenBefore: string;
  fenAfter: string;
  createdAt: Date;
}

export interface TimerState {
  me: number;
  opponent: number;
}

export interface CapturedPieces {
  w: CapturedPieceSymbol[];
  b: CapturedPieceSymbol[];
}

export interface GameMove {
  move: Move;
  fen: string;
  capturedPieces: CapturedPieces;
}

// ============================================================================
// Game Payload Types (Socket Events)
// ============================================================================

export interface GameInitPayload {
  color: Color;
  gameId: string;
  fen: string;
  timer: TimerState;
  increment: number;
  moves: Move[];
  username: string;
  opponent: {
    id: string;
    username: string;
  };
  capturedPieces: CapturedPieces;
}

export interface GameMovePayload {
  move: Move;
  fen: string;
  capturedPieces: CapturedPieces;
}

export interface GameOverPayload {
  reason: GameTerminationReason;
  winner: Color | null;
  capturedPieces: CapturedPieces;
}

export interface GameErrorPayload {
  message: string;
}

export interface DrawResponse {
  gameId: string;
  accepted: boolean;
}

// ============================================================================
// Game State Sync Types
// ============================================================================

export interface GameStateSyncPayload {
  success: boolean;
  gameState: {
    gameId: string;
    fen: string;
    turn: Color;
    moves: Move[];
    timers: {
      white: number;
      black: number;
    };
    players: {
      white: {
        userId: string;
        username: string;
        rating: number;
      };
      black: {
        userId: string;
        username: string;
        rating: number;
      };
    };
    status: 'active' | 'completed' | 'abandoned';
    result: 'white' | 'black' | 'draw' | 'ongoing';
  } | null;
  timestamp: number;
}

export interface GameMoveSuccessPayload {
  gameId: string;
  move: {
    from: string;
    to: string;
    piece: string;
    captured?: string;
    promotion?: string;
    san: string;
    fen: string;
  };
  gameState: {
    fen: string;
    turn: Color;
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
  };
  timers: {
    white: number;
    black: number;
  };
  moveNumber: number;
  timestamp: number;
}

export interface OpponentDisconnectedPayload {
  userId: string;
  gracePeriodMs: number;
  timestamp: number;
}

// ============================================================================
// Queue Types
// ============================================================================

export interface QueueJoinPayload {
  userId: string;
  username: string;
  timer: number;
  increment: number;
}

export interface QueueJoinSuccessPayload {
  queueId: string;
  timeControl: string;
  position: number;
  estimatedWaitTime?: number;
  timestamp: number;
}

export interface QueueLeavePayload {
  userId: string;
}

// ============================================================================
// Challenge Types
// ============================================================================

export interface ChallengeCreatePayload {
  opponentId: string;
  timer: number;
  increment: number;
}

export interface ChallengeStatus {
  challengeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
}

// ============================================================================
// Player Types
// ============================================================================

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
}

// ============================================================================
// Broadcast Payload Type
// ============================================================================

export type BroadcastPayload =
  | GameInitPayload
  | GameMovePayload
  | GameOverPayload
  | GameErrorPayload
  | DrawResponse;

// ============================================================================
// Constants
// ============================================================================

/**
 * Piece values for material calculation
 */
export const PIECE_VALUES = {
  p: 1, // Pawn
  n: 3, // Knight
  b: 3, // Bishop
  r: 5, // Rook
  q: 9, // Queen
} as const;

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
