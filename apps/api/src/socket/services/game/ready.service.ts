/**
 * Player Ready State Service
 *
 * Manages the ready state for players before a game starts.
 * Games only start when both players have signaled they are ready.
 */

import { redis } from '../../lib/redis';

// Redis key prefix for ready states
const READY_STATE_PREFIX = 'game:ready:';

// Ready state expiry in seconds
const READY_STATE_EXPIRY = 60;

export interface PlayerReadyState {
  whiteReady: boolean;
  blackReady: boolean;
  whiteReadyAt?: number;
  blackReadyAt?: number;
}

/**
 * Get the ready state for a game
 */
export async function getReadyState(gameId: string): Promise<PlayerReadyState | null> {
  const key = `${READY_STATE_PREFIX}${gameId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Set the ready state for a game
 */
export async function setReadyState(gameId: string, state: PlayerReadyState): Promise<void> {
  const key = `${READY_STATE_PREFIX}${gameId}`;
  await redis.set(key, JSON.stringify(state), 'EX', READY_STATE_EXPIRY);
}

/**
 * Delete the ready state (called when game starts)
 */
export async function deleteReadyState(gameId: string): Promise<void> {
  const key = `${READY_STATE_PREFIX}${gameId}`;
  await redis.del(key);
}

/**
 * Update ready state for a specific player
 */
export async function updatePlayerReady(
  gameId: string,
  isWhite: boolean,
): Promise<PlayerReadyState> {
  const now = Date.now();
  const currentState = await getReadyState(gameId);

  const updated: PlayerReadyState = {
    whiteReady: currentState?.whiteReady ?? false,
    blackReady: currentState?.blackReady ?? false,
    whiteReadyAt: currentState?.whiteReadyAt,
    blackReadyAt: currentState?.blackReadyAt,
  };

  if (isWhite) {
    updated.whiteReady = true;
    updated.whiteReadyAt = now;
  } else {
    updated.blackReady = true;
    updated.blackReadyAt = now;
  }

  await setReadyState(gameId, updated);
  return updated;
}

/**
 * Check if both players are ready
 */
export function areBothPlayersReady(state: PlayerReadyState): boolean {
  return state.whiteReady && state.blackReady;
}

/**
 * Get the actual start time (when the last player became ready)
 */
export function getActualStartTime(state: PlayerReadyState): number {
  const now = Date.now();
  return Math.max(state.whiteReadyAt || now, state.blackReadyAt || now);
}

/**
 * Scan for all ready state keys
 */
export async function scanReadyStateKeys(): Promise<string[]> {
  const pattern = `${READY_STATE_PREFIX}*`;
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
 * Extract game ID from ready state key
 */
export function extractGameIdFromReadyKey(key: string): string {
  return key.replace(READY_STATE_PREFIX, '');
}

export const READY_PREFIX = READY_STATE_PREFIX;
