import Bull from 'bull';

export const gameTimeoutQueue = new Bull(
  'game-timeouts',
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
);
