'use client';

import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { formatTimeControlDisplay } from '@workspace/utils/helpers';
import {
  ChallengeAcceptedPayload,
  ChallengeReceivedPayload,
  ValidationError,
} from '@workspace/utils/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from './use-socket';

interface ChallengeData {
  challengeId: string;
  sender: {
    id: string;
    username: string;
    rating: number;
  };
  timeControl: string;
  message?: string;
  expiresAt: Date;
}

interface UseChallengeReturn {
  isSending: boolean;
  receivedChallenge: ChallengeData | null;
  error: ValidationError | null;
  sendChallenge: (receiverId: string, timeControl: string, message?: string) => Promise<void>;
  acceptChallenge: (challengeId: string) => void;
  declineChallenge: (challengeId: string) => void;
  cancelChallenge: (challengeId: string) => void;
  clearReceivedChallenge: () => void;
}

export function useChallenge(): UseChallengeReturn {
  const { socket, isAuthenticated, isConnected } = useSocket({ autoConnect: true });
  const router = useRouter();

  const [isSending, setIsSending] = useState(false);
  const [receivedChallenge, setReceivedChallenge] = useState<ChallengeData | null>(null);
  const [error, setError] = useState<ValidationError | null>(null);

  const navigateToGame = useCallback(
    (gameId: string) => {
      router.push(`/game/${gameId}`);
    },
    [router],
  );

  const sendChallenge = useCallback(
    async (receiverId: string, timeControl: string, message?: string) => {
      if (!socket) {
        toast.error('Unable to send challenge', {
          description: 'Socket not initialized. Please refresh the page.',
        });
        return;
      }

      if (!isConnected) {
        toast.error('Unable to send challenge', {
          description: 'Not connected to server. Please wait or refresh.',
        });
        return;
      }

      if (!isAuthenticated) {
        toast.error('Unable to send challenge', {
          description: 'Not authenticated. Please log in again.',
        });
        return;
      }

      setIsSending(true);
      setError(null);

      try {
        socket.emit(SOCKET_EVENTS.CREATE_CHALLENGE, {
          receiverId,
          timeControl,
          message,
        });

        toast.success('Challenge sent!', {
          description: 'Waiting for opponent to accept...',
        });
      } catch (err) {
        toast.error('Failed to send challenge');
        console.error('[Challenge] Error sending challenge:', err);
      } finally {
        setIsSending(false);
      }
    },
    [socket, isConnected, isAuthenticated],
  );

  const acceptChallenge = useCallback(
    (challengeId: string) => {
      if (!socket) {
        return;
      }

      socket.emit(SOCKET_EVENTS.ACCEPT_CHALLENGE, { challengeId });
      setReceivedChallenge(null);
    },
    [socket],
  );

  const declineChallenge = useCallback(
    (challengeId: string) => {
      if (!socket) {
        return;
      }

      socket.emit(SOCKET_EVENTS.DECLINE_CHALLENGE, { challengeId });
      setReceivedChallenge(null);
      toast.info('Challenge declined');
    },
    [socket],
  );

  const cancelChallenge = useCallback(
    (challengeId: string) => {
      if (!socket) {
        return;
      }

      socket.emit(SOCKET_EVENTS.CANCEL_CHALLENGE, { challengeId });
      toast.info('Challenge cancelled');
    },
    [socket],
  );

  const clearReceivedChallenge = useCallback(() => {
    setReceivedChallenge(null);
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleChallengeReceived = (payload: ChallengeReceivedPayload) => {
      setReceivedChallenge({
        challengeId: payload.challengeId,
        sender: payload.sender,
        timeControl: payload.timeControl,
        message: payload.message,
        expiresAt: payload.expiresAt,
      });

      toast.info(`Challenge from ${payload.sender.username}!`, {
        description: `Time control: ${formatTimeControlDisplay(payload.timeControl)}`,
        duration: 10000,
      });
    };

    const handleChallengeAccepted = (payload: ChallengeAcceptedPayload) => {
      toast.success('Challenge accepted!', {
        description: 'Starting game...',
      });

      navigateToGame(payload.gameId);
    };

    const handleChallengeDeclined = () => {
      toast.info('Your challenge was declined');
      setIsSending(false);
    };

    const handleChallengeCancelled = () => {
      setReceivedChallenge(null);
      toast.info('The challenge was cancelled');
    };

    const handleChallengeExpired = () => {
      setReceivedChallenge(null);
      toast.warning('Challenge expired');
      setIsSending(false);
    };

    const handleValidationError = (errorPayload: ValidationError) => {
      setError(errorPayload);
      setIsSending(false);

      toast.error('Challenge error', {
        description: errorPayload.message,
      });
    };

    // Register listeners
    socket.on(SOCKET_EVENTS.CHALLENGE_RECEIVED, handleChallengeReceived);
    socket.on(SOCKET_EVENTS.CHALLENGE_ACCEPTED, handleChallengeAccepted);
    socket.on(SOCKET_EVENTS.CHALLENGE_DECLINED, handleChallengeDeclined);
    socket.on(SOCKET_EVENTS.CHALLENGE_CANCELLED, handleChallengeCancelled);
    socket.on(SOCKET_EVENTS.CHALLENGE_EXPIRED, handleChallengeExpired);
    socket.on(SOCKET_EVENTS.VALIDATION_ERROR, handleValidationError);

    console.log('[Challenge] Event listeners registered');

    // Cleanup
    return () => {
      console.log('[Challenge] Cleaning up event listeners');
      socket.off(SOCKET_EVENTS.CHALLENGE_RECEIVED, handleChallengeReceived);
      socket.off(SOCKET_EVENTS.CHALLENGE_ACCEPTED, handleChallengeAccepted);
      socket.off(SOCKET_EVENTS.CHALLENGE_DECLINED, handleChallengeDeclined);
      socket.off(SOCKET_EVENTS.CHALLENGE_CANCELLED, handleChallengeCancelled);
      socket.off(SOCKET_EVENTS.CHALLENGE_EXPIRED, handleChallengeExpired);
      socket.off(SOCKET_EVENTS.VALIDATION_ERROR, handleValidationError);
    };
  }, [socket, navigateToGame]);

  return {
    isSending,
    receivedChallenge,
    error,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    clearReceivedChallenge,
  };
}
