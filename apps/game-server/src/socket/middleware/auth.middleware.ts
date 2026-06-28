import { auth } from '@workspace/auth/server'; // Your Better Auth instance
import { AuthenticatedSocket } from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { logger } from '@workspace/logger';
import { Socket } from 'socket.io';
import { AuthenticationError } from './error.middleware';

const log = logger.child({ module: 'socket:auth' });

export const authMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> => {
  try {
    const reqHeaders = socket.request.headers;

    const headers = new Headers();
    if (reqHeaders.cookie) {
      headers.set('cookie', reqHeaders.cookie);
    }

    const authSession = await auth.api.getSession({ headers });
    const session = authSession?.session;
    if (!session) {
      return next(new AuthenticationError('Invalid session'));
    }

    const user = await prisma.user.findUnique({
      where: { id: session?.userId },
    });

    if (!user) {
      return next(new AuthenticationError('User not found'));
    }

    // Attach user data to socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.data = {
      id: user.id,
      userId: user.id,
      username: user.username,
      image: user.image || null,
      rating: user.rating,
      sessionId: session.id,
      connectedAt: new Date(),
      log: logger.child({
        module: 'socket',
        socketId: socket.id,
        userId: user.id,
        username: user.username,
      }),
    };

    // Update last seen timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Log successful authentication
    authSocket.data.log.info('authenticated');

    next();
  } catch (error) {
    log.error({ err: error }, 'authentication failed');
    next(new AuthenticationError('Internal server error'));
  }
};
