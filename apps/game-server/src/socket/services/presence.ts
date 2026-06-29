import { getUserRoomId, TypedServer } from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { SOCKET_EVENTS } from '@workspace/utils/constants';

/**
 * Presence Service
 *
 * Presence is derived from Socket.IO's own room membership: every connection
 * joins the user's personal room (`user:<id>`), so a user is "online" exactly
 * when that room has at least one live socket. The adapter tracks only live
 * connections and cleans them on disconnect (and across server restarts), so
 * there is no parallel registry to leak or reconcile.
 */

/**
 * Accepted-friend user IDs for a user, in either request direction.
 */
export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  return friendships.map((f) => (f.senderId === userId ? f.receiverId : f.senderId));
}

/**
 * Number of live sockets a user currently has (size of their personal room).
 * Used to detect the online/offline transitions (first connect / last disconnect).
 */
export async function countUserSockets(io: TypedServer, userId: string): Promise<number> {
  const sockets = await io.in(getUserRoomId(userId)).fetchSockets();
  return sockets.length;
}

/**
 * The subset of a user's friends that currently have at least one live socket.
 */
export async function getOnlineFriendIds(io: TypedServer, userId: string): Promise<string[]> {
  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) {
    return [];
  }

  const online = await Promise.all(
    friendIds.map(async (id) => ((await countUserSockets(io, id)) > 0 ? id : null)),
  );

  return online.filter((id): id is string => id !== null);
}

/**
 * Push a presence delta for `userId` to every friend, so anyone watching their
 * friends list sees the dot flip in real time. Emitted as a single broadcast to
 * all friend rooms at once.
 */
export async function broadcastPresenceToFriends(
  io: TypedServer,
  userId: string,
  online: boolean,
): Promise<void> {
  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) {
    return;
  }

  const rooms = friendIds.map(getUserRoomId);
  io.to(rooms).emit(SOCKET_EVENTS.FRIEND_PRESENCE_UPDATE, { userId, online });
}
