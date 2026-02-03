import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export async function setupRedisAdapter() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();

  pubClient.once('ready', () => {
    console.log('[Redis] Pub client connected');
  });

  subClient.once('ready', () => {
    console.log('[Redis] Sub client connected');
  });

  pubClient.on('error', (err) => console.error('[Redis] Pub client error', err));
  subClient.on('error', (err) => console.error('[Redis] Sub client error', err));

  const adapter = createAdapter(pubClient, subClient);
  console.log('[Socket.IO] Redis adapter attached');

  return { adapter, pubClient, subClient };
}
