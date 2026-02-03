import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

import { createServer as createHttpServer } from 'http';
import { createServer } from './express-server';
import { initializeSocketServer, shutdownSocketServer } from './socket';

const port = process.env.PORT || 4000;
const app = createServer();

const httpServer = createHttpServer(app);
const socketServer = initializeSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`[API] Server is running on http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await shutdownSocketServer(socketServer);
  httpServer.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await shutdownSocketServer(socketServer);
  httpServer.close(() => {
    process.exit(0);
  });
});
