import { AuthenticatedSocket, TypedServer } from '@workspace/contracts';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { asyncHandler } from '../middleware/error.middleware';
import { getOnlineFriendIds } from '../services/presence';

/**
 * Presence handlers.
 *
 * The online/offline deltas are pushed from the connection lifecycle (see
 * connection.ts). This handler serves the pull side: a client asks for the
 * current snapshot of which friends are online (e.g. when the friends page
 * mounts, or after a reconnect).
 */
export function setupPresenceHandlers(io: TypedServer): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.on(
      SOCKET_EVENTS.REQUEST_FRIENDS_PRESENCE,
      asyncHandler(socket, async () => {
        const online = await getOnlineFriendIds(io, socket.data.userId);
        socket.emit(SOCKET_EVENTS.FRIENDS_PRESENCE_SNAPSHOT, { online });
      }),
    );
  });
}
