import { TypedServer } from '@workspace/contracts';
import { logger } from '@workspace/logger';
import type { Server as HTTPServer } from 'http';
import type { Redis } from 'ioredis';
import { Server } from 'socket.io';
import {
  cleanupExpiredChallenges,
  processChallengeExpirationQueue,
} from '../queues/challenge.queue';
import { setupChallengeHandlers } from './handlers/challenge';
import { setupConnectionHandlers } from './handlers/connection';
import { setupGameHandlers } from './handlers/game';
import { setupMatchmakingHandlers } from './handlers/matchmaking';
import { setupPresenceHandlers } from './handlers/presence';
import { authMiddleware } from './middleware/auth.middleware';
import { setupRedisAdapter } from './redis';
import { gameService } from './services/game';

const log = logger.child({ module: 'socket:server' });

let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

export async function initializeSocketServer(httpServer: HTTPServer): Promise<TypedServer> {
  const allowedOriginsString: string = process.env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = allowedOriginsString
    ? allowedOriginsString.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173']; // Default dev origins

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    // Upgrade settings
    allowUpgrades: true,
    transports: ['websocket', 'polling'],
    // Compression
    perMessageDeflate: true,
  }) as TypedServer;

  io.use(authMiddleware);

  // Redis adapter when reachable. Required in prod (multi-instance broadcasts):
  // fail fast there; in dev fall back to the in-memory adapter.
  const redisSetup = await setupRedisAdapter();
  if (redisSetup) {
    io.adapter(redisSetup.adapter);
    redisPub = redisSetup.pubClient;
    redisSub = redisSetup.subClient;
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production but unreachable. Set REDIS_URL.');
  } else {
    log.warn('Redis unavailable, using in-memory adapter (dev/single-instance only)');
  }

  setupConnectionHandlers(io);
  setupMatchmakingHandlers(io);
  setupGameHandlers(io);
  setupChallengeHandlers(io);
  setupPresenceHandlers(io);

  processChallengeExpirationQueue(io);

  await cleanupExpiredChallenges(io);

  await gameService.recoverActiveGames();

  log.info('server initialized');

  setInterval(
    () => {
      const stats = {
        connectedSockets: io.sockets.sockets.size,
        rooms: io.sockets.adapter.rooms.size,
      };
      log.info({ stats }, 'server stats');
    },
    5 * 60 * 1000,
  ); // Every 5 minutes

  return io;
}

export async function shutdownSocketServer(io: Promise<TypedServer>): Promise<void> {
  log.info('shutting down server');

  (await io).disconnectSockets();

  await new Promise<void>((resolve) => {
    io.then((server) => {
      server.close(() => {
        log.info('server closed');
        resolve();
      });
    });
  });

  if (redisPub) {
    await redisPub.quit();
    log.info('redis pub client closed');
  }

  if (redisSub) {
    await redisSub.quit();
    log.info('redis sub client closed');
  }
}
