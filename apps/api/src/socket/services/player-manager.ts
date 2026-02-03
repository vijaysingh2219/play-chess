import { redis } from '../lib/redis';

/**
 * PlayerManager Service
 *
 * Manages socket connections for users across multiple tabs/devices.
 * Handles socket ID tracking and connection state.
 *
 * Key Features:
 * - Multiple sockets per user (multi-tab support)
 * - Redis-backed for horizontal scaling
 * - Automatic cleanup on disconnect
 * - User status tracking (in-game, matchmaking, idle)
 */
class PlayerManager {
  private readonly SOCKET_KEY_PREFIX = 'player:sockets:';
  private readonly ACTIVE_GAME_PREFIX = 'player:active_game:';
  private readonly STATUS_PREFIX = 'player:status:';

  private readonly SOCKET_TTL = 86400; // 24 hours

  /**
   * Add a socket connection for a user
   */
  async addSocket(userId: string, socketId: string): Promise<void> {
    const key = this.getSocketKey(userId);

    // Add socket to user's set of sockets
    await redis.sadd(key, socketId);

    // Set expiration
    await redis.expire(key, this.SOCKET_TTL);

    console.log(`[PlayerManager] Socket ${socketId} added for user ${userId}`);
  }

  /**
   * Remove a socket connection for a user
   */
  async removeSocket(userId: string, socketId: string): Promise<void> {
    const key = this.getSocketKey(userId);

    // Remove socket from set
    await redis.srem(key, socketId);

    // Check if user has any remaining connections
    const remaining = await this.getSocketCount(userId);

    console.log(
      `[PlayerManager] Socket ${socketId} removed for user ${userId}. Remaining: ${remaining}`,
    );
  }

  /**
   * Get all socket IDs for a user
   */
  async getUserSockets(userId: string): Promise<string[]> {
    const key = this.getSocketKey(userId);
    const sockets = await redis.smembers(key);
    return sockets as string[];
  }

  /**
   * Get socket count for a user
   */
  async getSocketCount(userId: string): Promise<number> {
    const key = this.getSocketKey(userId);
    const count = await redis.scard(key);
    return count;
  }

  /**
   * Check if user is online (has at least one active connection)
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const count = await this.getSocketCount(userId);
    return count > 0;
  }

  /**
   * Clean up all sockets for a user (useful for admin actions)
   */
  async disconnectUser(userId: string): Promise<void> {
    const key = this.getSocketKey(userId);
    await redis.del(key);
    console.log(`[PlayerManager] User ${userId} forcefully disconnected`);
  }

  /**
   * Get active game for user
   */
  async setUserActiveGame(userId: string, gameId: string): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    await redis.set(key, gameId, 'EX', 3600); // 1 hour
  }

  /**
   * Remove active game for user
   */
  async removeUserActiveGame(userId: string): Promise<void> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    await redis.del(key);
  }

  /**
   * Get user's active game
   */
  async getUserActiveGame(userId: string): Promise<string | null> {
    const key = `${this.ACTIVE_GAME_PREFIX}${userId}`;
    const gameId = await redis.get(key);
    return gameId as string | null;
  }

  /**
   * Set user status (in-game, matchmaking, idle)
   */
  async setUserStatus(userId: string, status: 'in-game' | 'matchmaking' | 'idle'): Promise<void> {
    const key = `player:status:${userId}`;
    await redis.set(key, status, 'EX', 3600);
  }

  /**
   * Get user status
   */
  async getUserStatus(userId: string): Promise<string | null> {
    const key = `${this.STATUS_PREFIX}${userId}`;
    const status = await redis.get(key);
    return status as string | null;
  }

  /**
   * Batch get user statuses
   */
  async getBatchUserStatuses(userIds: string[]): Promise<Map<string, string | null>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const pipeline = redis.pipeline();

    for (const userId of userIds) {
      const key = `${this.STATUS_PREFIX}${userId}`;
      pipeline.get(key);
    }

    const results = await pipeline.exec();
    const statuses = new Map<string, string | null>();

    if (results) {
      results.forEach((result, index) => {
        const [err, status] = result;
        const userId = userIds[index] ?? '';
        if (!err && userId) {
          statuses.set(userId, typeof status === 'string' ? status : null);
        }
      });
    }

    return statuses;
  }

  /**
   * Batch check if users are online
   */
  async getBatchOnlineStatus(userIds: string[]): Promise<Map<string, boolean>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      const key = this.getSocketKey(userId);
      pipeline.scard(key);
    }

    const results = await pipeline.exec();
    const onlineStatus = new Map<string, boolean>();

    if (results) {
      results.forEach((result, index) => {
        const [err, count] = result;
        const userId = userIds[index] ?? '';
        if (!err && userId) {
          onlineStatus.set(userId, (count as number) > 0);
        }
      });
    }

    return onlineStatus;
  }

  // Helper methods
  private getSocketKey(userId: string): string {
    return `${this.SOCKET_KEY_PREFIX}${userId}`;
  }
}

// Singleton instance
export const playerManager = new PlayerManager();
