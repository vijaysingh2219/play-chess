import { logger } from '@workspace/logger';
import Redis from 'ioredis';

const log = logger.child({ module: 'redis' });

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
      log.info('connected to Redis server');
    });

    redisClient.on('ready', () => {
      log.info('redis client ready');
    });

    redisClient.on('error', (err) => {
      log.error({ err }, 'redis client error');
    });

    redisClient.on('close', () => {
      log.info('redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      log.info('reconnecting to Redis');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    log.info('connection closed');
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
