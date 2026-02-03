/**
 * Game Service
 *
 * Main orchestration service for game operations.
 * Uses sub-services for specific concerns like caching, locking, and persistence.
 */

import { Color, GameTerminationReason, prisma, Winner } from '@workspace/db';
import { GameState, GameType, MoveData } from '@workspace/utils/types';
import { Chess, PieceSymbol } from 'chess.js';
import { calculateEloChanges } from '../elo';
import {
  cacheGame,
  extractGameIdFromKey,
  getGameCache,
  removeGameCache,
  scanActiveGameKeys,
  updateGameCache,
} from './cache.service';
import { acquireLock, releaseLock } from './lock.service';
import {
  abortGame as abortGameInDB,
  completeGame,
  saveMoveToDatabase,
  updateBothPlayerRatings,
  updateGameStartTime,
  updateGameTimes,
} from './persistence.service';
import {
  areBothPlayersReady,
  deleteReadyState,
  extractGameIdFromReadyKey,
  getActualStartTime,
  getReadyState,
  scanReadyStateKeys,
  setReadyState,
  updatePlayerReady,
} from './ready.service';
import {
  buildGameStateFromCache,
  buildGameStateFromDB,
  loadGameFromDatabase,
} from './state.service';
import {
  cancelAllTimeoutJobs,
  cancelTimeoutJob,
  getTimeoutQueue,
  scheduleTimeoutJob,
  TimeoutJob,
} from './timeout.service';

// Constants
const LAG_GRACE_PERIOD = 100; // Lag compensation in ms
const FALLBACK_SWEEP_INTERVAL = 5000; // 5 seconds
const MAX_READY_WAIT = 30000; // 30 seconds

/**
 * Game Service Class
 *
 * Orchestrates game operations using specialized sub-services.
 */
class GameService {
  constructor() {
    // Process timeout jobs
    getTimeoutQueue().process(async (job) => {
      await this.processTimeoutJob(job.data);
    });

    // Start background tasks
    this.startFallbackSweep();
    this.startReadyWatchdog();
  }

  /**
   * Create a new game
   */
  async createGame(
    whitePlayerId: string,
    blackPlayerId: string,
    timeControl: string,
    initialTime: number,
    incrementTime: number,
    whiteEloAtStart: number,
    blackEloAtStart: number,
    gameType: GameType,
    isRanked: boolean,
  ): Promise<string> {
    const game = await prisma.game.create({
      data: {
        whitePlayerId,
        blackPlayerId,
        timeControl,
        initialTime,
        incrementTime,
        whiteTimeLeft: initialTime * 1000,
        blackTimeLeft: initialTime * 1000,
        gameType: gameType,
        whiteEloAtStart,
        blackEloAtStart,
        isRanked,
        startedAt: new Date(),
      },
    });

    // Initialize ready state
    await setReadyState(game.id, {
      whiteReady: false,
      blackReady: false,
    });

    // Cache game
    await cacheGame(game);

    return game.id;
  }

  /**
   * Mark player as ready
   */
  async markPlayerReady(
    gameId: string,
    userId: string,
  ): Promise<{ bothReady: boolean; actualStartTime?: number }> {
    const gameState = await this.loadGame(gameId);
    if (!gameState) {
      throw new Error('Game not found');
    }

    const readyState = await getReadyState(gameId);
    if (!readyState) {
      return { bothReady: true };
    }

    const isWhite = userId === gameState.whitePlayerId;
    const updated = await updatePlayerReady(gameId, isWhite);

    console.log(`[Ready] Player ${isWhite ? 'White' : 'Black'} ready for ${gameId}`);

    if (areBothPlayersReady(updated)) {
      console.log(`[Ready] Both players ready! Starting clocks for ${gameId}`);

      const actualStartTime = getActualStartTime(updated);

      await updateGameCache(gameId, { lastMoveAt: actualStartTime });
      await updateGameStartTime(gameId, new Date(actualStartTime));
      await deleteReadyState(gameId);

      // Schedule timeout for first player (White)
      await scheduleTimeoutJob(gameId, gameState.whitePlayerId, 'w', gameState.whiteTimeLeft);

      return { bothReady: true, actualStartTime };
    }

    return { bothReady: false };
  }

  /**
   * Load game from cache or database
   */
  async loadGame(gameId: string, calculateCurrentTimeLeft = true): Promise<GameState | null> {
    const cached = await getGameCache(gameId);

    if (cached) {
      const readyState = await getReadyState(gameId);
      if (readyState && (!readyState.whiteReady || !readyState.blackReady)) {
        return buildGameStateFromCache(cached, cached.whiteTimeLeft, cached.blackTimeLeft);
      }

      let whiteTimeLeft = cached.whiteTimeLeft;
      let blackTimeLeft = cached.blackTimeLeft;

      if (calculateCurrentTimeLeft) {
        const now = Date.now();
        const lastMoveTime =
          typeof cached.lastMoveAt === 'string'
            ? new Date(cached.lastMoveAt).getTime()
            : cached.lastMoveAt;
        const elapsed = now - lastMoveTime;

        whiteTimeLeft =
          cached.currentTurn === 'w'
            ? Math.max(0, cached.whiteTimeLeft - elapsed)
            : cached.whiteTimeLeft;

        blackTimeLeft =
          cached.currentTurn === 'b'
            ? Math.max(0, cached.blackTimeLeft - elapsed)
            : cached.blackTimeLeft;
      }

      return buildGameStateFromCache(cached, whiteTimeLeft, blackTimeLeft);
    }

    // Load from database
    const game = await loadGameFromDatabase(gameId);
    if (!game) return null;

    if (game.status === 'ONGOING') {
      await cacheGame(game);
    }

    const moves = game.moves.map((move) => ({
      ...move,
      color: move.color as Color,
      captured: move.captured as PieceSymbol | null,
      promotion: move.promotion as PieceSymbol | null,
    }));

    return buildGameStateFromDB({ ...game, moves });
  }

  /**
   * Validate and make a move
   */
  async makeMove(
    gameId: string,
    userId: string,
    from: string,
    to: string,
    promotion?: 'q' | 'r' | 'b' | 'n',
  ): Promise<{ moveData: MoveData; gameState: GameState }> {
    const readyState = await getReadyState(gameId);
    if (readyState && (!readyState.whiteReady || !readyState.blackReady)) {
      throw new Error('Waiting for both players to be ready');
    }

    const lock = await acquireLock(gameId);
    if (!lock) {
      throw new Error('Game is locked by another operation');
    }

    try {
      const gameState = await this.loadGame(gameId, false);
      if (!gameState) throw new Error('Game not found');
      if (gameState.status !== 'ONGOING') throw new Error('Game is not in progress');

      const isWhiteTurn = gameState.currentTurn === 'w';
      const isPlayersTurn = isWhiteTurn
        ? userId === gameState.whitePlayerId
        : userId === gameState.blackPlayerId;

      if (!isPlayersTurn) throw new Error('Not your turn');

      const chess = new Chess(gameState.currentFen);
      const move = chess.move({ from, to, promotion });

      if (!move) throw new Error('Invalid move');

      // Calculate time
      const cache = await getGameCache(gameId);
      if (!cache) throw new Error('Game not cached');

      const now = Date.now();
      const turnStartTime =
        typeof cache.lastMoveAt === 'string'
          ? new Date(cache.lastMoveAt).getTime()
          : cache.lastMoveAt;

      const timeSpent = now - turnStartTime;
      const actualTimeSpent = Math.max(0, timeSpent - LAG_GRACE_PERIOD);

      const isWhite = gameState.currentTurn === 'w';
      const timeLeft = isWhite ? gameState.whiteTimeLeft : gameState.blackTimeLeft;
      const incrementBonus = gameState.moves.length > 0 ? gameState.incrementTime * 1000 : 0;
      const newTimeLeft = Math.max(0, timeLeft - actualTimeSpent + incrementBonus);

      if (isWhite) {
        gameState.whiteTimeLeft = newTimeLeft;
      } else {
        gameState.blackTimeLeft = newTimeLeft;
      }

      const moveData: MoveData = {
        moveNumber: gameState.moves.length + 1,
        color: gameState.currentTurn,
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured: move.captured ?? null,
        promotion: move.promotion ?? null,
        san: move.san,
        lan: move.lan,
        fenBefore: gameState.currentFen,
        fenAfter: chess.fen(),
        createdAt: new Date(),
        timeSpent: actualTimeSpent,
        timeLeft: newTimeLeft,
      };

      gameState.currentFen = chess.fen();
      gameState.currentTurn = chess.turn();
      gameState.moves.push(moveData);
      gameState.lastMoveAt = now;

      // Update cache
      await updateGameCache(gameId, {
        currentFen: chess.fen(),
        currentTurn: chess.turn(),
        whiteTimeLeft: gameState.whiteTimeLeft,
        blackTimeLeft: gameState.blackTimeLeft,
        lastMoveAt: now,
      });

      // Save to database (async)
      saveMoveToDatabase(gameId, moveData).catch((error) => {
        console.error('[Game] Error saving move:', error);
      });

      updateGameTimes(gameId, gameState.whiteTimeLeft, gameState.blackTimeLeft).catch((error) => {
        console.error('[Game] Error updating times:', error);
      });

      // Check for game end
      await this.checkGameEndConditions(gameId, chess);

      // Manage timeouts
      await cancelTimeoutJob(gameId, userId);
      const opponentId = isWhite ? gameState.blackPlayerId : gameState.whitePlayerId;
      const opponentTimeLeft = isWhite ? gameState.blackTimeLeft : gameState.whiteTimeLeft;
      await scheduleTimeoutJob(gameId, opponentId, chess.turn(), opponentTimeLeft);

      return { moveData, gameState };
    } finally {
      await releaseLock(gameId);
    }
  }

  /**
   * Check for game end conditions
   */
  private async checkGameEndConditions(gameId: string, chess: Chess): Promise<void> {
    let winner: Winner | null = null;
    let reason: GameTerminationReason | null = null;

    if (chess.isCheckmate()) {
      winner = chess.turn() === 'w' ? 'BLACK' : 'WHITE';
      reason = 'CHECKMATE';
    } else if (chess.isStalemate()) {
      winner = 'DRAW';
      reason = 'STALEMATE';
    } else if (chess.isInsufficientMaterial()) {
      winner = 'DRAW';
      reason = 'INSUFFICIENT_MATERIAL';
    } else if (chess.isThreefoldRepetition()) {
      winner = 'DRAW';
      reason = 'THREEFOLD_REPETITION';
    } else if (chess.isDraw()) {
      winner = 'DRAW';
      reason = 'FIFTY_MOVE_RULE';
    }

    if (winner && reason) {
      await this.endGame(gameId, winner, reason);
    }
  }

  /**
   * End a game
   */
  async endGame(
    gameId: string,
    winner: Winner,
    reason: GameTerminationReason,
  ): Promise<{
    ratings: {
      whiteChange: number;
      blackChange: number;
      whiteNewRating: number;
      blackNewRating: number;
    };
  }> {
    const gameState = await this.loadGame(gameId);
    if (!gameState) throw new Error('Game not found');

    if (gameState.status !== 'ONGOING') {
      return {
        ratings: {
          whiteChange: 0,
          blackChange: 0,
          whiteNewRating: gameState.whitePlayer.rating,
          blackNewRating: gameState.blackPlayer.rating,
        },
      };
    }

    const eloChanges = calculateEloChanges(
      gameState.whitePlayer.rating,
      gameState.blackPlayer.rating,
      winner,
    );

    const chess = new Chess();
    for (const move of gameState.moves) {
      chess.move(move.san);
    }

    await completeGame(gameId, {
      winner,
      reason,
      finalFen: gameState.currentFen,
      pgn: chess.pgn(),
      eloChangeWhite: eloChanges.whiteChange,
      eloChangeBlack: eloChanges.blackChange,
      totalMoves: gameState.moves.length,
      durationSeconds: Math.floor((Date.now() - gameState.startedAt) / 1000),
    });

    await updateBothPlayerRatings(
      gameState.whitePlayerId,
      gameState.blackPlayerId,
      eloChanges.whiteNewRating,
      eloChanges.blackNewRating,
    );

    await cancelAllTimeoutJobs(gameId, gameState.whitePlayerId, gameState.blackPlayerId);
    await removeGameCache(gameId);

    console.log(`[Game] Game ${gameId} ended: ${winner} by ${reason}`);

    return { ratings: eloChanges };
  }

  /**
   * Resign game
   */
  async resignGame(gameId: string, userId: string) {
    const gameState = await this.loadGame(gameId);
    if (!gameState) throw new Error('Game not found');

    const isWhite = userId === gameState.whitePlayerId;
    const winner = isWhite ? 'BLACK' : 'WHITE';

    return this.endGame(gameId, winner, 'RESIGNATION');
  }

  /**
   * Handle timeout
   */
  async handleTimeout(gameId: string, timedOutPlayerId: string) {
    const gameState = await this.loadGame(gameId);
    if (!gameState || gameState.status !== 'ONGOING') return;

    const isWhite = timedOutPlayerId === gameState.whitePlayerId;
    const winner = isWhite ? 'BLACK' : 'WHITE';

    return this.endGame(gameId, winner, 'TIMEOUT');
  }

  /**
   * Offer draw
   */
  async offerDraw(gameId: string, userId: string): Promise<void> {
    const gameState = await this.loadGame(gameId);
    if (!gameState) throw new Error('Game not found');

    if (userId !== gameState.whitePlayerId && userId !== gameState.blackPlayerId) {
      throw new Error('Not a player in this game');
    }
  }

  /**
   * Accept draw
   */
  async acceptDraw(gameId: string) {
    return this.endGame(gameId, 'DRAW', 'AGREEMENT');
  }

  /**
   * Abort game
   */
  async abortGame(gameId: string): Promise<void> {
    const gameState = await this.loadGame(gameId);
    if (!gameState) throw new Error('Game not found');
    if (gameState.status !== 'ONGOING') return;

    await abortGameInDB(gameId);
    await cancelAllTimeoutJobs(gameId, gameState.whitePlayerId, gameState.blackPlayerId);
    await removeGameCache(gameId);

    console.log(`[Game] Game ${gameId} aborted`);
  }

  /**
   * Get game cache (exposed for handlers)
   */
  async getGameCache(gameId: string) {
    return getGameCache(gameId);
  }

  /**
   * Process timeout job
   */
  private async processTimeoutJob(job: TimeoutJob): Promise<void> {
    const { gameId, playerId, color } = job;

    console.log(`[Timeout] Processing timeout for ${gameId}, player ${playerId}`);

    const lock = await acquireLock(gameId);
    if (!lock) {
      console.log(`[Timeout] Game ${gameId} is locked, will retry`);
      await scheduleTimeoutJob(gameId, playerId, color, 500);
      return;
    }

    try {
      const gameState = await this.loadGame(gameId);
      if (!gameState || gameState.status !== 'ONGOING') {
        console.log(`[Timeout] Game ${gameId} no longer active`);
        return;
      }

      const isPlayersTurn =
        (gameState.currentTurn === 'w' && playerId === gameState.whitePlayerId) ||
        (gameState.currentTurn === 'b' && playerId === gameState.blackPlayerId);

      if (!isPlayersTurn) {
        console.log(`[Timeout] Player ${playerId} already moved`);
        return;
      }

      if (!gameState.lastMoveAt) return;

      const now = Date.now();
      const elapsed = now - gameState.lastMoveAt;
      const actualTimeLeft =
        gameState.currentTurn === 'w'
          ? gameState.whiteTimeLeft - elapsed
          : gameState.blackTimeLeft - elapsed;

      if (actualTimeLeft <= 0) {
        console.log(`[Timeout] Confirmed for ${gameId}, player ${playerId}`);
        await this.handleTimeout(gameId, playerId);
      } else if (actualTimeLeft < 5000) {
        console.log(`[Timeout] Rescheduling ${gameId}, ${actualTimeLeft}ms left`);
        await scheduleTimeoutJob(gameId, playerId, color, actualTimeLeft);
      } else {
        console.log(`[Timeout] Time extended for ${gameId}, rescheduling`);
        await scheduleTimeoutJob(gameId, playerId, color, actualTimeLeft);
      }
    } finally {
      await releaseLock(gameId);
    }
  }

  /**
   * Fallback sweep for missed timeouts
   */
  private startFallbackSweep(): void {
    setInterval(async () => {
      try {
        const keys = await scanActiveGameKeys();

        for (const key of keys) {
          const gameId = extractGameIdFromKey(key);
          const cache = await getGameCache(gameId);
          if (!cache) continue;

          const now = Date.now();
          const lastMoveTime =
            typeof cache.lastMoveAt === 'string'
              ? new Date(cache.lastMoveAt).getTime()
              : cache.lastMoveAt;
          const elapsed = now - lastMoveTime;

          if (cache.currentTurn === 'w' && elapsed >= cache.whiteTimeLeft) {
            await this.handleTimeout(gameId, cache.whitePlayerId);
          }

          if (cache.currentTurn === 'b' && elapsed >= cache.blackTimeLeft) {
            await this.handleTimeout(gameId, cache.blackPlayerId);
          }
        }
      } catch (error) {
        console.error('[Sweep] Fallback sweep error:', error);
      }
    }, FALLBACK_SWEEP_INTERVAL);
  }

  /**
   * Watchdog to auto-start games if one player doesn't ready up
   */
  private startReadyWatchdog(): void {
    setInterval(async () => {
      try {
        const keys = await scanReadyStateKeys();

        for (const key of keys) {
          const gameId = extractGameIdFromReadyKey(key);
          const readyState = await getReadyState(gameId);

          if (!readyState) continue;

          const oldestReadyTime = Math.min(
            readyState.whiteReadyAt || Infinity,
            readyState.blackReadyAt || Infinity,
          );

          const waitTime = Date.now() - oldestReadyTime;

          if (waitTime > MAX_READY_WAIT) {
            console.log(`[Watchdog] Force-starting ${gameId} after ${waitTime}ms wait`);

            const gameState = await this.loadGame(gameId);
            if (!gameState) continue;

            const slowPlayerId = readyState.whiteReady
              ? gameState.blackPlayerId
              : gameState.whitePlayerId;

            await this.markPlayerReady(gameId, slowPlayerId);
          }
        }
      } catch (error) {
        console.error('[Watchdog] Error:', error);
      }
    }, 5000);
  }
}

// Singleton instance
export const gameService = new GameService();
