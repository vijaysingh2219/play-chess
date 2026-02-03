import { prisma } from '@workspace/db';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import { getUserRoomId, TypedServer } from '@workspace/utils/types';
import Bull from 'bull';

interface ChallengeExpirationJob {
  challengeId: string;
}

/**
 * Challenge Expiration Queue
 *
 * Handles automatic expiration of challenges after 5 minutes
 * using Bull job queue for reliability and scalability
 */
export const challengeExpirationQueue = new Bull<ChallengeExpirationJob>('challenge-expiration', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Process challenge expiration jobs
 */
export function processChallengeExpirationQueue(io: TypedServer): void {
  challengeExpirationQueue.process(async (job) => {
    const { challengeId } = job.data;

    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: {
          id: true,
          status: true,
          senderId: true,
          receiverId: true,
          expiresAt: true,
        },
      });

      if (!challenge) {
        return;
      }

      if (challenge.status !== 'PENDING') {
        return;
      }

      if (challenge.expiresAt > new Date()) {
        return;
      }

      await prisma.challenge.update({
        where: { id: challengeId },
        data: { status: 'EXPIRED' },
      });

      io.to(getUserRoomId(challenge.senderId)).emit(SOCKET_EVENTS.CHALLENGE_EXPIRED, {
        challengeId,
      });

      io.to(getUserRoomId(challenge.receiverId)).emit(SOCKET_EVENTS.CHALLENGE_EXPIRED, {
        challengeId,
      });

      console.log(`[Challenge Queue] Challenge ${challengeId} expired`);
    } catch (error) {
      console.error(`[Challenge Queue] Error expiring challenge ${challengeId}:`, error);
      throw error;
    }
  });

  challengeExpirationQueue.on('completed', (job) => {
    console.log(`[Challenge Queue] Job ${job.id} completed`);
  });

  challengeExpirationQueue.on('failed', (job, err) => {
    console.error(`[Challenge Queue] Job ${job?.id} failed:`, err);
  });

  console.log('[Challenge Queue] Processor started');
}

/**
 * Schedule challenge expiration (5 minutes delay)
 */
export async function scheduleChallengeExpiration(challengeId: string): Promise<void> {
  const delay = 5 * 60 * 1000;

  await challengeExpirationQueue.add(
    { challengeId },
    {
      delay,
      jobId: `challenge-expiration-${challengeId}`,
    },
  );
}

/**
 * Cancel challenge expiration job
 */
export async function cancelChallengeExpiration(challengeId: string): Promise<void> {
  const jobId = `challenge-expiration-${challengeId}`;

  try {
    const job = await challengeExpirationQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (error) {
    console.error(`[Challenge Queue] Error cancelling expiration for ${challengeId}:`, error);
  }
}

/**
 * Clean up expired challenges on startup
 */
export async function cleanupExpiredChallenges(io: TypedServer): Promise<void> {
  console.log('[Challenge Queue] Cleaning up expired challenges...');

  try {
    const expiredChallenges = await prisma.challenge.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
      },
    });

    if (expiredChallenges.length > 0) {
      await prisma.challenge.updateMany({
        where: {
          id: {
            in: expiredChallenges.map((c) => c.id),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      for (const challenge of expiredChallenges) {
        io.to(getUserRoomId(challenge.senderId)).emit(SOCKET_EVENTS.CHALLENGE_EXPIRED, {
          challengeId: challenge.id,
        });

        io.to(getUserRoomId(challenge.receiverId)).emit(SOCKET_EVENTS.CHALLENGE_EXPIRED, {
          challengeId: challenge.id,
        });
      }

      console.log(`[Challenge Queue] Cleaned up ${expiredChallenges.length} expired challenges`);
    }
  } catch (error) {
    console.error('[Challenge Queue] Error cleaning up expired challenges:', error);
  }
}
