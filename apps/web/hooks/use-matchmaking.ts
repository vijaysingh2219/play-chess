'use client';

import { SOCKET_EVENTS } from '@workspace/utils/constants';
import {
  FindMatchPayload,
  MatchFoundPayload,
  MatchmakingError,
  QueueStatusPayload,
} from '@workspace/utils/types';
import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './use-socket';

interface UseMatchmakingReturn {
  isSearching: boolean;
  queueStatus: QueueStatusPayload | null;
  matchFound: MatchFoundPayload | null;
  error: MatchmakingError | null;
  findMatch: (timeControl: string, ratingRange?: number) => void;
  cancelSearch: () => void;
  latency: number;
}

export function useMatchmaking(): UseMatchmakingReturn {
  const { socket, isAuthenticated, latency } = useSocket({ autoConnect: true });

  const [isSearching, setIsSearching] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatusPayload | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundPayload | null>(null);
  const [error, setError] = useState<MatchmakingError | null>(null);

  const findMatch = useCallback(
    (timeControl: string, ratingRange?: number) => {
      if (!socket || !isAuthenticated) {
        console.error('[Matchmaking] Socket not connected or not authenticated');
        return;
      }

      setIsSearching(true);
      setMatchFound(null);
      setError(null);

      const payload: FindMatchPayload = {
        timeControl,
        ratingRange,
      };

      socket.emit('matchmaking:find', payload);
    },
    [socket, isAuthenticated],
  );

  const cancelSearch = useCallback(() => {
    if (!socket) {
      return;
    }

    setIsSearching(false);
    setQueueStatus(null);
    setError(null);

    socket.emit('matchmaking:cancel');
  }, [socket]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleMatchFound = (payload: MatchFoundPayload) => {
      console.log('[Matchmaking] Match found!', payload);
      setIsSearching(false);
      setQueueStatus(null);
      setMatchFound(payload);
    };

    const handleQueueStatus = (payload: QueueStatusPayload) => {
      console.log('[Matchmaking] Queue status:', payload);
      setQueueStatus(payload);
    };

    const handleError = (error: MatchmakingError) => {
      console.error('[Matchmaking] Error:', error);
      setIsSearching(false);
      setError(error);
    };

    // Register listeners
    socket.on(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
    socket.on(SOCKET_EVENTS.QUEUE_STATUS, handleQueueStatus);
    socket.on(SOCKET_EVENTS.MATCHMAKING_ERROR, handleError);

    // Cleanup
    return () => {
      socket.off(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
      socket.off(SOCKET_EVENTS.QUEUE_STATUS, handleQueueStatus);
      socket.off(SOCKET_EVENTS.MATCHMAKING_ERROR, handleError);
    };
  }, [socket]);

  /**
   * Cancel search on unmount
   */
  useEffect(() => {
    return () => {
      if (isSearching) {
        cancelSearch();
      }
    };
  }, [isSearching, cancelSearch]);

  return {
    isSearching,
    queueStatus,
    matchFound,
    error,
    findMatch,
    cancelSearch,
    latency,
  };
}
