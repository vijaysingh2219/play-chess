import { redis } from '../lib/redis';

/**
 * PlayerManager Service
 *
 * Tracks which active game a user is currently in (Redis-backed, 1h TTL).
 * Used for matchmaking eligibility and for cleanup when a game ends.
 */
class PlayerManager {
  private readonly ACTIVE_GAME_PREFIX = 'player:active_game:';

  /** Record the game a user is currently playing. */
  async setUserActiveGame(userId: string, gameId: string): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    await redis.set(key, gameId, 'EX', 3600); // 1 hour
  }

  /** Clear a user's active game (e.g. when the game ends). */
  async removeUserActiveGame(userId: string): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    await redis.del(key);
  }

  /** The game a user is currently in, or null. */
  async getUserActiveGame(userId: string): Promise<string | null> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    const gameId = await redis.get(key);
    return gameId as string | null;
  }
}

// Singleton instance
export const playerManager = new PlayerManager();
