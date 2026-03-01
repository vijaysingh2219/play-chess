'use client';

import { useSession } from '@workspace/auth/client';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { ClientToServerEvents, ServerToClientEvents } from '@workspace/utils/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Typed socket instance
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

interface UseSocketReturn {
  socket: TypedSocket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  latency: number;
  connect: () => void;
  disconnect: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, onConnect, onDisconnect, onError } = options;

  const session = useSession();
  const hasSession = !!session.data?.user;
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [latency, setLatency] = useState(0);

  const socketRef = useRef<TypedSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Stop ping checks
   */
  const stopPingCheck = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Start periodic ping checks
   */
  const startPingCheck = useCallback(() => {
    stopPingCheck();

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping:check', {
          timestamp: Date.now(),
        });
      }
    }, 5000); // Every 5 seconds
  }, [stopPingCheck]);

  /**
   * Disconnect socket
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // Remove all listeners to avoid memory leaks
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      stopPingCheck();
    }
  }, [stopPingCheck]);

  /**
   * Initialize socket connection
   */
  const connect = useCallback(() => {
    // Always disconnect any existing socket before creating a new one
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      stopPingCheck();
    }

    // Create socket instance
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    }) as TypedSocket;

    socketRef.current = socket;

    // Connection event handlers
    socket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      onConnect?.();
      startPingCheck();
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
      stopPingCheck();
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
      onError?.(error);
    });

    // Authentication event
    socket.on(SOCKET_EVENTS.USER_AUTHENTICATED, (payload) => {
      console.log('[Socket] Authenticated:', payload.username);
      setIsAuthenticated(true);
    });

    // Authentication error
    socket.on(SOCKET_EVENTS.AUTHENTICATION_ERROR, (error) => {
      console.error('[Socket] Authentication error:', error);
      setIsAuthenticated(false);
      disconnect();
      onError?.(error);
    });

    // Ping response (for latency measurement)
    socket.on(SOCKET_EVENTS.PONG_RESPONSE, (payload) => {
      setLatency(payload.latency);
    });

    // Handle active game found event
    socket.on(SOCKET_EVENTS.ACTIVE_GAME_FOUND, (payload) => {
      if (payload?.gameId && router) {
        router.push(`/game/${payload.gameId}`);
      }
    });
  }, [onConnect, onDisconnect, onError, disconnect, startPingCheck, stopPingCheck, router]);

  /**
   * Auto-connect on mount (only when user has an active session)
   */
  useEffect(() => {
    if (autoConnect && hasSession) {
      connect();
    }

    // Disconnect if the session becomes invalid
    if (!hasSession && socketRef.current) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, hasSession, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    isAuthenticated,
    latency,
    connect,
    disconnect,
  };
}
