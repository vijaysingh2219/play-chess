/**
 * Game Cache Service
 *
 * Handles Redis caching for active games including:
 * - Caching game state
 * - Retrieving cached games
 * - Updating cache
 * - Cache invalidation
 */

import { ActiveGameCache, GameState } from '@workspace/utils/types';
import { Chess } from 'chess.js';
import { redis } from '../../lib/redis';

// Redis key prefix for active games
const ACTIVE_GAME_PREFIX = 'game:active:';

// Cache expiry time: 2 hours
const CACHE_EXPIRY_SECONDS = 7200;

/**
 * Cache a game for faster access
 */
export async function cacheGame(game: {
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
  const key = `${ACTIVE_GAME_PREFIX}${game.id}`;

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
    currentTurn: chess.turn() as 'w' | 'b',
    lastMoveAt,
  };

  await redis.set(key, JSON.stringify(cache), 'EX', CACHE_EXPIRY_SECONDS);
}

/**
 * Get game cache from Redis
 */
export async function getGameCache(gameId: string): Promise<ActiveGameCache | null> {
  const key = `${ACTIVE_GAME_PREFIX}${gameId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Update game cache with partial updates
 */
export async function updateGameCache(
  gameId: string,
  updates: Partial<ActiveGameCache>,
): Promise<void> {
  const cache = await getGameCache(gameId);
  if (cache) {
    const updated = { ...cache, ...updates };
    const key = `${ACTIVE_GAME_PREFIX}${gameId}`;
    await redis.set(key, JSON.stringify(updated), 'EX', CACHE_EXPIRY_SECONDS);
  }
}

/**
 * Remove game from cache
 */
export async function removeGameCache(gameId: string): Promise<void> {
  const key = `${ACTIVE_GAME_PREFIX}${gameId}`;
  await redis.del(key);
}

/**
 * Scan for active game keys matching a pattern
 */
export async function scanActiveGameKeys(): Promise<string[]> {
  const pattern = `${ACTIVE_GAME_PREFIX}*`;
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
 * Extract game ID from cache key
 */
export function extractGameIdFromKey(key: string): string {
  return key.replace(ACTIVE_GAME_PREFIX, '');
}

export const GAME_CACHE_PREFIX = ACTIVE_GAME_PREFIX;
