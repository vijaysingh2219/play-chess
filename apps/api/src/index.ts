import './env';

import { logger } from '@workspace/logger';
import { createServer as createHttpServer } from 'http';
import { createServer } from './server';
import { initializeSocketServer, shutdownSocketServer } from './socket';

const PORT = process.env.PORT || 4000;

// Create Express app and wrap it in a raw HTTP server so Socket.IO can share
// the same port/listener.
const app = createServer();
const httpServer = createHttpServer(app);

// initializeSocketServer is async; keep the promise so shutdownSocketServer
// (which awaits it) can dispose the same instance during graceful shutdown.
const socketServer = initializeSocketServer(httpServer);

// Fail fast if socket init fails (e.g. Redis unreachable in prod) so the
// instance exits instead of silently serving broken realtime.
socketServer.catch((err) => {
  logger.error({ err }, 'failed to initialize Socket.IO server');
  process.exit(1);
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'api server listening');
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'received shutdown signal, shutting down gracefully');
  await shutdownSocketServer(socketServer);
  httpServer.close(() => {
    logger.info('process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
