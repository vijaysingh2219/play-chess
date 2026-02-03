import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

    redisClient = new Redis(redisUrl, {
      // Connection pool settings
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,

      // Reconnection strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },

      // Connection timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,

      // Automatic pipeline
      enableAutoPipelining: true,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis server');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Redis client ready');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Redis client error:', err);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting to Redis...');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}

export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    const client = getRedisClient();
    const value = client[prop as keyof Redis];

    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  },
});
