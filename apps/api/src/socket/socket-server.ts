import { TypedServer } from '@workspace/utils/types';
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
import { authMiddleware } from './middleware/auth.middleware';
import { setupRedisAdapter } from './redis';

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

  const { adapter, pubClient, subClient } = await setupRedisAdapter();
  io.adapter(adapter);
  redisPub = pubClient;
  redisSub = subClient;

  setupConnectionHandlers(io);
  setupMatchmakingHandlers(io);
  setupGameHandlers(io);
  setupChallengeHandlers(io);

  processChallengeExpirationQueue(io);

  await cleanupExpiredChallenges(io);

  console.log('[Socket.IO] Server initialized');

  setInterval(
    () => {
      const stats = {
        connectedSockets: io.sockets.sockets.size,
        rooms: io.sockets.adapter.rooms.size,
      };
      console.log('[Socket.IO] Stats:', stats);
    },
    5 * 60 * 1000,
  ); // Every 5 minutes

  return io;
}

export async function shutdownSocketServer(io: Promise<TypedServer>): Promise<void> {
  console.log('[Socket.IO] Shutting down server...');

  (await io).disconnectSockets();

  await new Promise<void>((resolve) => {
    io.then((server) => {
      server.close(() => {
        console.log('[Socket.IO] Server closed');
        resolve();
      });
    });
  });

  if (redisPub) {
    await redisPub.quit();
    console.log('[Redis] Pub client closed');
  }

  if (redisSub) {
    await redisSub.quit();
    console.log('[Redis] Sub client closed');
  }
}
