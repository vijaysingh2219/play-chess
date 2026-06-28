import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from '@workspace/logger';
import Redis from 'ioredis';

const log = logger.child({ module: 'socket:redis' });

const CONNECT_TIMEOUT_MS = 3000;

async function connectWithTimeout(client: Redis): Promise<void> {
  await Promise.race([
    client.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis connection timed out')), CONNECT_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Sets up the Socket.IO Redis adapter for cross-instance broadcasting.
 * Returns `null` when Redis is unreachable so the caller can fall back to the
 * in-memory adapter.
 */
export async function setupRedisAdapter() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  // lazyConnect so we can verify connectivity before committing to the adapter.
  const pubClient = new Redis(redisUrl, { lazyConnect: true });

  try {
    await connectWithTimeout(pubClient);

    const subClient = pubClient.duplicate();
    await connectWithTimeout(subClient);

    pubClient.on('error', (err) => log.error({ err }, 'redis pub client error'));
    subClient.on('error', (err) => log.error({ err }, 'redis sub client error'));

    const adapter = createAdapter(pubClient, subClient);
    log.info({ redisUrl }, 'redis adapter attached');

    return { adapter, pubClient, subClient };
  } catch (err) {
    log.error({ err, redisUrl }, 'could not connect to Redis; falling back to in-memory adapter');
    pubClient.disconnect();
    return null;
  }
}
