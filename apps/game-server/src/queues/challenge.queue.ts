import { getUserRoomId, TypedServer } from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { logger } from '@workspace/logger';
import { SOCKET_EVENTS } from '@workspace/utils/constants';
import Bull from 'bull';

const log = logger.child({ module: 'queue:challenge' });

interface ChallengeExpirationJob {
  challengeId: string;
}

/**
 * Challenge Expiration Queue
 *
 * Handles automatic expiration of challenges after 5 minutes
 * using Bull job queue for reliability and scalability
 */
export const challengeExpirationQueue = new Bull<ChallengeExpirationJob>(
  'challenge-expiration',
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
);

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

      log.info({ challengeId }, 'challenge expired');
    } catch (error) {
      log.error({ err: error, challengeId }, 'failed to expire challenge');
      throw error;
    }
  });

  challengeExpirationQueue.on('completed', (job) => {
    log.debug({ jobId: job.id }, 'job completed');
  });

  challengeExpirationQueue.on('failed', (job, err) => {
    log.error({ err, jobId: job?.id }, 'job failed');
  });

  log.info('processor started');
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
    log.error({ err: error, challengeId }, 'failed to cancel challenge expiration');
  }
}

/**
 * Clean up expired challenges on startup
 */
export async function cleanupExpiredChallenges(io: TypedServer): Promise<void> {
  log.info('cleaning up expired challenges');

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

      log.info({ count: expiredChallenges.length }, 'cleaned up expired challenges');
    }
  } catch (error) {
    log.error({ err: error }, 'failed to clean up expired challenges');
  }
}
