import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

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

    pubClient.on('error', (err) => console.error('[Redis] Pub client error', err));
    subClient.on('error', (err) => console.error('[Redis] Sub client error', err));

    const adapter = createAdapter(pubClient, subClient);
    console.log(`[Socket.IO] Redis adapter attached (${redisUrl})`);

    return { adapter, pubClient, subClient };
  } catch (err) {
    console.error(
      `[Socket.IO] Could not connect to Redis at ${redisUrl}; falling back to in-memory adapter.`,
      err instanceof Error ? err.message : err,
    );
    pubClient.disconnect();
    return null;
  }
}
