import { Color, GameTerminationReason, prisma, Winner } from '@workspace/db';
import { ActiveGameCache, GameState, GameType, MoveData } from '@workspace/utils/types';
import Bull from 'bull';
import { Chess, PieceSymbol } from 'chess.js';
import { redis } from '../lib/redis';
import { calculateEloChanges } from './elo';
import { gameTimeoutQueue } from './timeouts';

interface TimeoutJob {
  gameId: string;
  playerId: string;
  color: Color;
  expectedTimeoutAt: number;
}

interface PlayerReadyState {
  whiteReady: boolean;
  blackReady: boolean;
  whiteReadyAt?: number;
  blackReadyAt?: number;
}

/**
 * Game Service
 *
 * Manages game state, move validation, and game termination.
 * Uses chess.js for move validation and game rules.
 */
class GameService {
  // Redis keys
  private readonly ACTIVE_GAME_PREFIX = 'game:active:';
  private readonly GAME_LOCK_PREFIX = 'game:lock:';
  private readonly READY_STATE_PREFIX = 'game:ready:';

  // Lag compensation (to account for network latency)
  private readonly LAG_GRACE_PERIOD = 100;
  // Lock settings
  private readonly LOCK_TTL = 10; // seconds

  // Timeout queue (Bull for distributed systems)
  private timeoutQueue: Bull.Queue<TimeoutJob>;

  private readonly FALLBACK_SWEEP_INTERVAL = 5000; // 5 seconds
  private readonly MAX_READY_WAIT = 30000;

  constructor() {
    // Initialize timeout queue
    this.timeoutQueue = gameTimeoutQueue;

    // Process timeout jobs
    this.timeoutQueue.process(async (job) => {
      await this.processTimeoutJob(job.data);
    });

    // Start fallback sweep (catches any missed timeouts)
    this.startFallbackSweep();
    this.startReadyWatchdog();
  }

  /**
   * Create a new game (clocks PAUSED until both players ready)
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

    // Initialize ready state (clocks paused)
    await this.setReadyState(game.id, {
      whiteReady: false,
      blackReady: false,
    });

    // Cache game
    await this.cacheGame(game);

    return game.id;
  }

  /**
   * Mark player as ready
   * When BOTH players ready → start the clock
   */
  async markPlayerReady(
    gameId: string,
    userId: string,
  ): Promise<{
    bothReady: boolean;
    actualStartTime?: number;
  }> {
    const gameState = await this.loadGame(gameId);
    if (!gameState) {
      throw new Error('Game not found');
    }

    const readyState = await this.getReadyState(gameId);
    if (!readyState) {
      // Game already started (no ready state means it's in progress)
      return { bothReady: true };
    }

    const isWhite = userId === gameState.whitePlayerId;
    const now = Date.now();

    // Update ready state
    const updated: PlayerReadyState = {
      ...readyState,
      ...(isWhite
        ? { whiteReady: true, whiteReadyAt: now }
        : { blackReady: true, blackReadyAt: now }),
    };

    await this.setReadyState(gameId, updated);

    console.log(`[Ready] Player ${isWhite ? 'White' : 'Black'} ready for ${gameId}`);

    // Check if both players ready
    if (updated.whiteReady && updated.blackReady) {
      console.log(`[Ready] Both players ready! Starting clocks for ${gameId}`);

      // CRITICAL: Set actual start time to when LAST player became ready
      const actualStartTime = Math.max(updated.whiteReadyAt || now, updated.blackReadyAt || now);

      // Update cache with actual start time
      await this.updateGameCache(gameId, {
        lastMoveAt: actualStartTime,
      });

      // Update database
      await prisma.game.update({
        where: { id: gameId },
        data: {
          startedAt: new Date(actualStartTime),
        },
      });

      // Delete ready state (no longer needed)
      await this.deleteReadyState(gameId);

      // Schedule timeout for first player (White)
      await this.scheduleTimeoutJob(gameId, gameState.whitePlayerId, 'w', gameState.whiteTimeLeft);

      return { bothReady: true, actualStartTime };
    }

    return { bothReady: false };
  }

  /**
   * Load game from database and cache it
   * First checks Redis cache with real-time calculations, then falls back to DB
   */
  async loadGame(
    gameId: string,
    calculateCurrentTimeLeft: boolean = true,
  ): Promise<GameState | null> {
    // Check cache first
    const cached = await this.getGameCache(gameId);
    if (cached) {
      // Check if game is waiting for ready
      const readyState = await this.getReadyState(gameId);
      if (readyState && (!readyState.whiteReady || !readyState.blackReady)) {
        // Game hasn't started yet - return initial times
        return this.buildGameStateFromCache(cached, cached.whiteTimeLeft, cached.blackTimeLeft);
      }

      let whiteTimeLeft = cached.whiteTimeLeft;
      let blackTimeLeft = cached.blackTimeLeft;

      if (calculateCurrentTimeLeft) {
        // Calculate current time left based on elapsed time since last move
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

      // Build game state from cache with updated times
      return this.buildGameStateFromCache(cached, whiteTimeLeft, blackTimeLeft);
    }

    // Load from database
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: {
          select: { id: true, username: true, name: true, image: true, rating: true },
        },
        blackPlayer: {
          select: { id: true, username: true, name: true, image: true, rating: true },
        },
        moves: {
          orderBy: { moveNumber: 'asc' },
        },
      },
    });

    if (!game) {
      return null;
    }

    if (game.status === 'ONGOING') {
      await this.cacheGame(game);
    }

    const moves = game.moves.map((move) => ({
      ...move,
      color: move.color as Color,
      captured: move.captured as PieceSymbol | null,
      promotion: move.promotion as PieceSymbol | null,
    }));

    return this.buildGameStateFromDB({ ...game, moves });
  }

  /**
   * Watchdog to auto-start games if one player doesn't ready up
   * After 30 seconds, start anyway (penalizes slow loader)
   */
  private startReadyWatchdog(): void {
    setInterval(async () => {
      try {
        const keys = await this.scanKeys(`${this.READY_STATE_PREFIX}*`);

        for (const key of keys) {
          const gameId = key.replace(this.READY_STATE_PREFIX, '');
          const readyState = await this.getReadyState(gameId);

          if (!readyState) continue;

          const oldestReadyTime = Math.min(
            readyState.whiteReadyAt || Infinity,
            readyState.blackReadyAt || Infinity,
          );

          const waitTime = Date.now() - oldestReadyTime;

          // If one player ready for > 30s, start game anyway
          if (waitTime > this.MAX_READY_WAIT) {
            console.log(`[Watchdog] Force-starting ${gameId} after ${waitTime}ms wait`);

            const gameState = await this.loadGame(gameId);
            if (!gameState) continue;

            // Force-ready the slow player
            const slowPlayerId = readyState.whiteReady
              ? gameState.blackPlayerId
              : gameState.whitePlayerId;

            await this.markPlayerReady(gameId, slowPlayerId);
          }
        }
      } catch (error) {
        console.error('[Watchdog] Error:', error);
      }
    }, 5000); // Check every 5 seconds
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
  ): Promise<{
    moveData: MoveData;
    gameState: GameState;
    gameEndInfo?: {
      winner: Winner;
      reason: GameTerminationReason;
      ratings: {
        whiteChange: number;
        blackChange: number;
        whiteNewRating: number;
        blackNewRating: number;
      };
    };
  }> {
    // Check if game is waiting for ready
    const readyState = await this.getReadyState(gameId);
    if (readyState && (!readyState.whiteReady || !readyState.blackReady)) {
      throw new Error('Waiting for both players to be ready');
    }

    // Acquire lock to prevent race conditions
    const lock = await this.acquireLock(gameId);
    if (!lock) {
      throw new Error('Game is locked by another operation');
    }

    try {
      const gameState = await this.loadGame(gameId, false);
      if (!gameState) {
        throw new Error('Game not found');
      }

      if (gameState.status !== 'ONGOING') {
        throw new Error('Game is not in progress');
      }

      // Check if it's the player's turn
      const isWhiteTurn = gameState.currentTurn === 'w';
      const isPlayersTurn = isWhiteTurn
        ? userId === gameState.whitePlayerId
        : userId === gameState.blackPlayerId;

      if (!isPlayersTurn) {
        throw new Error('Not your turn');
      }

      // Create chess instance with current position
      const chess = new Chess(gameState.currentFen);

      // Validate and make move
      const move = chess.move({
        from,
        to,
        promotion,
      });

      if (!move) {
        throw new Error('Invalid move');
      }

      // Get time spent on this move
      const cache = await this.getGameCache(gameId);
      if (!cache) throw new Error('Game not cached');

      const now = Date.now();
      let turnStartTime: number;

      if (cache && cache.lastMoveAt) {
        turnStartTime =
          typeof cache.lastMoveAt === 'string'
            ? new Date(cache.lastMoveAt).getTime()
            : cache.lastMoveAt;
      } else if (gameState.lastMoveAt) {
        turnStartTime = gameState.lastMoveAt;
      } else {
        turnStartTime = cache.lastMoveAt;
      }

      const timeSpent = now - turnStartTime;

      // Apply lag compensation
      const actualTimeSpent = Math.max(0, timeSpent - this.LAG_GRACE_PERIOD);

      // Update time left for current player
      const isWhite = gameState.currentTurn === 'w';
      const timeLeft = isWhite ? gameState.whiteTimeLeft : gameState.blackTimeLeft;

      // Subtract time spent and add increment (if not first move)
      const incrementBonus = gameState.moves.length > 0 ? gameState.incrementTime * 1000 : 0;
      const newTimeLeft = Math.max(0, timeLeft - actualTimeSpent + incrementBonus);

      if (isWhite) {
        gameState.whiteTimeLeft = newTimeLeft;
      } else {
        gameState.blackTimeLeft = newTimeLeft;
      }

      // Create move data
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

      // Update game state
      gameState.currentFen = chess.fen();
      gameState.currentTurn = chess.turn();
      gameState.moves.push(moveData);
      gameState.lastMoveAt = now;

      // Update cache
      await this.updateGameCache(gameId, {
        currentFen: chess.fen(),
        currentTurn: chess.turn(),
        whiteTimeLeft: gameState.whiteTimeLeft,
        blackTimeLeft: gameState.blackTimeLeft,
        lastMoveAt: now,
      });

      // Save move to database (async)
      this.saveMoveToDatabase(gameId, moveData).catch((error) => {
        console.error('[Game] Error saving move:', error);
      });

      // Update times in database (async)
      this.updateGameTimes(gameId, gameState.whiteTimeLeft, gameState.blackTimeLeft).catch(
        (error) => {
          console.error('[Game] Error updating times:', error);
        },
      );

      // Check for game end conditions
      const gameEndInfo = await this.checkGameEndConditions(gameId, chess);

      // Only manage timeouts if game is still ongoing
      if (!gameEndInfo) {
        await this.cancelTimeoutJob(gameId, userId);
        const opponentId = isWhite ? gameState.blackPlayerId : gameState.whitePlayerId;
        const opponentTimeLeft = isWhite ? gameState.blackTimeLeft : gameState.whiteTimeLeft;
        await this.scheduleTimeoutJob(gameId, opponentId, chess.turn(), opponentTimeLeft);
      } else {
        await this.cancelTimeoutJob(gameId, userId);
      }

      return {
        moveData,
        gameState: {
          ...gameState,
          whiteTimeLeft: gameState.whiteTimeLeft,
          blackTimeLeft: gameState.blackTimeLeft,
        },
        gameEndInfo: gameEndInfo ?? undefined,
      };
    } finally {
      await this.releaseLock(gameId);
    }
  }

  private async getReadyState(gameId: string): Promise<PlayerReadyState | null> {
    const key = `${this.READY_STATE_PREFIX}${gameId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  private async setReadyState(gameId: string, state: PlayerReadyState): Promise<void> {
    const key = `${this.READY_STATE_PREFIX}${gameId}`;
    await redis.set(key, JSON.stringify(state), 'EX', 60); // 60s expiry
  }

  private async deleteReadyState(gameId: string): Promise<void> {
    const key = `${this.READY_STATE_PREFIX}${gameId}`;
    await redis.del(key);
  }

  /**
   * Schedule a timeout job for when a player's time expires
   * This is the KEY to scalable time management
   */
  private async scheduleTimeoutJob(
    gameId: string,
    playerId: string,
    color: Color,
    timeLeft: number,
  ): Promise<void> {
    // Don't schedule if time is already up
    if (timeLeft <= 0) {
      await this.handleTimeout(gameId, playerId);
      return;
    }

    // Add buffer for network latency and processing
    const buffer = 500; // 500ms buffer
    const delay = Math.max(0, timeLeft - buffer);

    const expectedTimeoutAt = Date.now() + timeLeft;

    await this.timeoutQueue.add(
      {
        gameId,
        playerId,
        color,
        expectedTimeoutAt,
      },
      {
        delay,
        jobId: `timeout:${gameId}:${playerId}`, // Idempotent job ID
      },
    );

    console.log(`[Timeout] Scheduled for ${gameId}, player ${playerId} in ${timeLeft}ms`);
  }

  /**
   * Process a timeout job
   * CRITICAL: Always re-check actual game state to avoid race conditions
   */
  private async processTimeoutJob(job: TimeoutJob): Promise<void> {
    const { gameId, playerId, color } = job;

    console.log(`[Timeout] Processing timeout for ${gameId}, player ${playerId}`);

    // Acquire lock to prevent race with concurrent move
    const lock = await this.acquireLock(gameId);
    if (!lock) {
      console.log(`[Timeout] Game ${gameId} is locked, will retry`);
      // Reschedule with short delay
      await this.scheduleTimeoutJob(gameId, playerId, color, 500);
      return;
    }

    try {
      // Re-load game state (source of truth)
      const gameState = await this.loadGame(gameId);

      if (!gameState || gameState.status !== 'ONGOING') {
        console.log(`[Timeout] Game ${gameId} no longer active`);
        return;
      }

      // Check if it's still this player's turn
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
        // CONFIRMED TIMEOUT
        console.log(`[Timeout] Confirmed for ${gameId}, player ${playerId}`);
        await this.handleTimeout(gameId, playerId);
      } else if (actualTimeLeft < 5000) {
        // Close to timeout, reschedule precisely
        console.log(`[Timeout] Rescheduling ${gameId}, ${actualTimeLeft}ms left`);
        await this.scheduleTimeoutJob(gameId, playerId, color, actualTimeLeft);
      } else {
        // Time was extended (e.g., by increment), reschedule
        console.log(`[Timeout] Time extended for ${gameId}, rescheduling`);
        await this.scheduleTimeoutJob(gameId, playerId, color, actualTimeLeft);
      }
    } finally {
      await this.releaseLock(gameId);
    }
  }

  /**
   * Cancel timeout job for a player (when they make a move)
   */
  private async cancelTimeoutJob(gameId: string, playerId: string): Promise<void> {
    const jobId = `timeout:${gameId}:${playerId}`;
    const job = await this.timeoutQueue.getJob(jobId);

    if (job) {
      await job.remove();
      console.log(`[Timeout] Cancelled for ${gameId}, player ${playerId}`);
    }
  }

  /**
   * Fallback sweep for missed timeouts
   * Runs every 5 seconds to catch any edge cases
   */
  private startFallbackSweep(): void {
    setInterval(async () => {
      try {
        const keys = await this.scanKeys(`${this.ACTIVE_GAME_PREFIX}*`);

        for (const key of keys) {
          const gameId = key.replace(this.ACTIVE_GAME_PREFIX, '');

          // Only check games with critical time situations
          const cache = await this.getGameCache(gameId);
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
    }, this.FALLBACK_SWEEP_INTERVAL);
  }

  /**
   * Check if game has ended
   * Returns game end info if the game ended, null otherwise
   */
  private async checkGameEndConditions(
    gameId: string,
    chess: Chess,
  ): Promise<{
    winner: Winner;
    reason: GameTerminationReason;
    ratings: {
      whiteChange: number;
      blackChange: number;
      whiteNewRating: number;
      blackNewRating: number;
    };
  } | null> {
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
      const { ratings } = await this.endGame(gameId, winner, reason);
      return { winner, reason, ratings };
    }

    return null;
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

    if (!gameState) {
      throw new Error('Game not found');
    }

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

    // Calculate ELO changes
    const whiteRating = gameState.whitePlayer.rating;
    const blackRating = gameState.blackPlayer.rating;
    const eloChanges = calculateEloChanges(whiteRating, blackRating, winner);

    // Generate PGN
    const chess = new Chess();
    for (const move of gameState.moves) {
      chess.move(move.san);
    }
    const pgn = chess.pgn();

    // Update game in database
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        winner,
        reason,
        finalFen: gameState.currentFen,
        pgn,
        eloChangeWhite: eloChanges.whiteChange,
        eloChangeBlack: eloChanges.blackChange,
        endedAt: new Date(),
        totalMoves: gameState.moves.length,
        durationSeconds: Math.floor((Date.now() - gameState.startedAt) / 1000),
      },
    });

    // Update player ratings
    await Promise.all([
      prisma.user.update({
        where: { id: gameState.whitePlayerId },
        data: { rating: eloChanges.whiteNewRating },
      }),
      prisma.user.update({
        where: { id: gameState.blackPlayerId },
        data: { rating: eloChanges.blackNewRating },
      }),
    ]);

    // Cancel any pending timeout jobs
    await this.cancelTimeoutJob(gameId, gameState.whitePlayerId);
    await this.cancelTimeoutJob(gameId, gameState.blackPlayerId);

    // Remove from cache
    await this.removeGameCache(gameId);

    console.log(`[Game] Game ${gameId} ended: ${winner} by ${reason}`);

    return { ratings: eloChanges };
  }

  /**
   * Resign game
   */
  async resignGame(
    gameId: string,
    userId: string,
  ): Promise<{
    ratings: {
      whiteChange: number;
      blackChange: number;
      whiteNewRating: number;
      blackNewRating: number;
    };
  }> {
    const gameState = await this.loadGame(gameId);

    if (!gameState) {
      throw new Error('Game not found');
    }

    const isWhite = userId === gameState.whitePlayerId;
    const winner = isWhite ? 'BLACK' : 'WHITE';

    const ratings = await this.endGame(gameId, winner, 'RESIGNATION');
    return ratings;
  }

  /**
   * Handle timeout
   */
  async handleTimeout(
    gameId: string,
    timedOutPlayerId: string,
  ): Promise<{
    ratings: {
      whiteChange: number;
      blackChange: number;
      whiteNewRating: number;
      blackNewRating: number;
    };
  } | void> {
    const gameState = await this.loadGame(gameId);

    if (!gameState || gameState.status !== 'ONGOING') {
      return;
    }

    const isWhite = timedOutPlayerId === gameState.whitePlayerId;
    const winner = isWhite ? 'BLACK' : 'WHITE';

    const ratings = await this.endGame(gameId, winner, 'TIMEOUT');
    return ratings;
  }

  /**
   * Offer draw
   */
  async offerDraw(gameId: string, userId: string): Promise<void> {
    const gameState = await this.loadGame(gameId);

    if (!gameState) {
      throw new Error('Game not found');
    }

    if (userId !== gameState.whitePlayerId && userId !== gameState.blackPlayerId) {
      throw new Error('Not a player in this game');
    }
  }

  /**
   * Accept draw
   */
  async acceptDraw(gameId: string): Promise<{
    ratings: {
      whiteChange: number;
      blackChange: number;
      whiteNewRating: number;
      blackNewRating: number;
    };
  }> {
    const ratings = await this.endGame(gameId, 'DRAW', 'AGREEMENT');
    return ratings;
  }

  /**
   * Abort game
   */
  async abortGame(gameId: string): Promise<void> {
    const gameState = await this.loadGame(gameId);

    if (!gameState) {
      throw new Error('Game not found');
    }

    if (gameState.status !== 'ONGOING') {
      return;
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'ABORTED',
        endedAt: new Date(),
      },
    });

    await this.cancelTimeoutJob(gameId, gameState.whitePlayerId);
    await this.cancelTimeoutJob(gameId, gameState.blackPlayerId);
    await this.removeGameCache(gameId);

    console.log(`[Game] Game ${gameId} aborted`);
  }

  /**
   * Cache game for faster access
   */
  private async cacheGame(game: {
    id: string;
    whitePlayerId: string;
    blackPlayerId: string;
    status: GameState['status'];
    currentFen?: string;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    moves?: { san: string; createdAt?: Date }[];
    startedAt: Date;
  }): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${game.id}`;

    const chess = new Chess();
    if (game.moves && game.moves.length > 0) {
      for (const move of game.moves) {
        chess.move(move.san);
      }
    }

    let lastMoveAt: number;
    if (game.moves && game.moves.length > 0) {
      const lastMove = game.moves[game.moves.length - 1];
      if (lastMove && lastMove.createdAt) {
        lastMoveAt = new Date(lastMove.createdAt).getTime();
      } else {
        lastMoveAt = game.startedAt.getTime();
      }
    } else {
      lastMoveAt = game.startedAt.getTime();
    }

    const cache: ActiveGameCache = {
      gameId: game.id,
      whitePlayerId: game.whitePlayerId,
      blackPlayerId: game.blackPlayerId,
      status: game.status,
      currentFen: chess.fen(),
      whiteTimeLeft: game.whiteTimeLeft,
      blackTimeLeft: game.blackTimeLeft,
      currentTurn: chess.turn() as Color,
      lastMoveAt,
    };

    await redis.set(key, JSON.stringify(cache), 'EX', 7200); // 2 hours
  }

  /**
   * Get game cache
   */
  async getGameCache(gameId: string): Promise<ActiveGameCache | null> {
    const key = `${this.ACTIVE_GAME_PREFIX}${gameId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update game cache
   */
  private async updateGameCache(gameId: string, updates: Partial<ActiveGameCache>): Promise<void> {
    const cache = await this.getGameCache(gameId);
    if (cache) {
      const updated = { ...cache, ...updates };
      const key = `${this.ACTIVE_GAME_PREFIX}${gameId}`;
      await redis.set(key, JSON.stringify(updated), 'EX', 7200);
    }
  }

  /**
   * Remove game cache
   */
  private async removeGameCache(gameId: string): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${gameId}`;
    await redis.del(key);
  }

  /**
   * Acquire lock
   */
  private async acquireLock(gameId: string): Promise<boolean> {
    const key = `${this.GAME_LOCK_PREFIX}${gameId}`;
    const result = await redis.set(key, '1', 'EX', this.LOCK_TTL, 'NX');
    return result === 'OK';
  }

  /**
   * Release lock
   */
  private async releaseLock(gameId: string): Promise<void> {
    const key = `${this.GAME_LOCK_PREFIX}${gameId}`;
    await redis.del(key);
  }

  /**
   * Scan Redis keys
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Build game state from database record with optional time calculation
   */
  private buildGameStateFromDB(game: {
    id: string;
    whitePlayerId: string;
    blackPlayerId: string;
    whitePlayer: GameState['whitePlayer'];
    blackPlayer: GameState['blackPlayer'];
    status: GameState['status'];
    currentFen?: string;
    moves: MoveData[];
    whiteTimeLeft: number;
    blackTimeLeft: number;
    timeControl: string;
    initialTime: number;
    incrementTime: number;
    startedAt: Date;
  }): GameState {
    const chess = new Chess();

    if (game.moves && game.moves.length > 0) {
      for (const move of game.moves) {
        chess.move(move.san);
      }
    }

    let lastMoveAt: number | undefined = undefined;
    if (game.moves && game.moves.length > 0) {
      const lastMove = game.moves[game.moves.length - 1];
      if (lastMove && lastMove.createdAt) {
        lastMoveAt = new Date(lastMove.createdAt).getTime();
      }
    }

    return {
      id: game.id,
      whitePlayerId: game.whitePlayerId,
      blackPlayerId: game.blackPlayerId,
      whitePlayer: game.whitePlayer,
      blackPlayer: game.blackPlayer,
      status: game.status,
      currentFen: chess.fen(),
      moves: game.moves,
      whiteTimeLeft: game.whiteTimeLeft,
      blackTimeLeft: game.blackTimeLeft,
      currentTurn: chess.turn(),
      timeControl: game.timeControl,
      initialTime: game.initialTime,
      incrementTime: game.incrementTime,
      startedAt: game.startedAt.getTime(),
      lastMoveAt,
    };
  }

  /**
   * Build game state from cache with calculated time values
   */
  private async buildGameStateFromCache(
    cache: ActiveGameCache,
    whiteTimeLeft: number,
    blackTimeLeft: number,
  ): Promise<GameState | null> {
    const game = await prisma.game.findUnique({
      where: { id: cache.gameId },
      include: {
        whitePlayer: {
          select: { id: true, username: true, name: true, image: true, rating: true },
        },
        blackPlayer: {
          select: { id: true, username: true, name: true, image: true, rating: true },
        },
        moves: {
          orderBy: { moveNumber: 'asc' },
        },
      },
    });

    if (!game) return null;

    const lastMoveTime =
      typeof cache.lastMoveAt === 'string'
        ? new Date(cache.lastMoveAt).getTime()
        : cache.lastMoveAt;

    return {
      id: cache.gameId,
      whitePlayerId: cache.whitePlayerId,
      blackPlayerId: cache.blackPlayerId,
      whitePlayer: game.whitePlayer,
      blackPlayer: game.blackPlayer,
      status: cache.status,
      currentFen: cache.currentFen,
      moves: game.moves?.map((move) => ({
        ...move,
        captured: move.captured as PieceSymbol | null,
        promotion: move.promotion as PieceSymbol | null,
        createdAt: new Date(move.createdAt),
      })),
      whiteTimeLeft,
      blackTimeLeft,
      currentTurn: cache.currentTurn,
      timeControl: game.timeControl,
      initialTime: game.initialTime,
      incrementTime: game.incrementTime,
      startedAt: game.startedAt.getTime(),
      lastMoveAt: lastMoveTime,
    };
  }

  /**
   * Save move to database
   */
  private async saveMoveToDatabase(gameId: string, moveData: MoveData): Promise<void> {
    await prisma.move.create({
      data: {
        gameId,
        moveNumber: moveData.moveNumber,
        color: moveData.color,
        from: moveData.from,
        to: moveData.to,
        piece: moveData.piece,
        captured: moveData.captured,
        promotion: moveData.promotion,
        san: moveData.san,
        lan: moveData.lan,
        fenBefore: moveData.fenBefore,
        fenAfter: moveData.fenAfter,
        timeSpent: moveData.timeSpent,
        timeLeft: moveData.timeLeft,
      },
    });
  }

  /**
   * Update game times in database
   */
  private async updateGameTimes(
    gameId: string,
    whiteTimeLeft: number,
    blackTimeLeft: number,
  ): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: {
        whiteTimeLeft,
        blackTimeLeft,
      },
    });
  }
}

// Singleton instance
export const gameService = new GameService();
