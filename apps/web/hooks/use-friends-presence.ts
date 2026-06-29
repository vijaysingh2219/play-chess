'use client';

import { FriendPresenceUpdatePayload, FriendsPresenceSnapshotPayload } from '@workspace/contracts';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { useEffect, useState } from 'react';
import { useSocket } from './use-socket';

interface UseFriendsPresenceReturn {
  /** User IDs of friends currently online. */
  onlineFriendIds: Set<string>;
}

/**
 * Tracks which of the current user's friends are online.
 *
 * On (re)connection it requests a one-time snapshot, then keeps it current by
 * applying real-time online/offline deltas pushed from the server.
 */
export function useFriendsPresence(): UseFriendsPresenceReturn {
  const { socket } = useSocket({ autoConnect: true });
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleSnapshot = (payload: FriendsPresenceSnapshotPayload) => {
      setOnlineFriendIds(new Set(payload.online));
    };

    const handleUpdate = (payload: FriendPresenceUpdatePayload) => {
      setOnlineFriendIds((prev) => {
        const next = new Set(prev);
        if (payload.online) {
          next.add(payload.userId);
        } else {
          next.delete(payload.userId);
        }
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.FRIENDS_PRESENCE_SNAPSHOT, handleSnapshot);
    socket.on(SOCKET_EVENTS.FRIEND_PRESENCE_UPDATE, handleUpdate);

    // A non-null socket from useSocket is already connected & authenticated, so
    // it's safe to request the snapshot immediately.
    socket.emit(SOCKET_EVENTS.REQUEST_FRIENDS_PRESENCE);

    return () => {
      socket.off(SOCKET_EVENTS.FRIENDS_PRESENCE_SNAPSHOT, handleSnapshot);
      socket.off(SOCKET_EVENTS.FRIEND_PRESENCE_UPDATE, handleUpdate);
    };
  }, [socket]);

  return { onlineFriendIds };
}
