/**
 * Game Lock Service
 *
 * Provides distributed locking for game operations to prevent race conditions.
 * Uses Redis for lock coordination across multiple server instances.
 */

import { redis } from '../../lib/redis';

// Redis key prefix for game locks
const GAME_LOCK_PREFIX = 'game:lock:';

// Lock time-to-live in seconds
const LOCK_TTL = 10;

/**
 * Acquire a lock for a game operation
 * Returns true if lock was acquired, false if already locked
 */
export async function acquireLock(gameId: string): Promise<boolean> {
  const key = `${GAME_LOCK_PREFIX}${gameId}`;
  const result = await redis.set(key, '1', 'EX', LOCK_TTL, 'NX');
  return result === 'OK';
}

/**
 * Release a lock for a game
 */
export async function releaseLock(gameId: string): Promise<void> {
  const key = `${GAME_LOCK_PREFIX}${gameId}`;
  await redis.del(key);
}

/**
 * Execute a function with a lock, automatically releasing on completion
 */
export async function withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T | null> {
  const acquired = await acquireLock(gameId);
  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(gameId);
  }
}
