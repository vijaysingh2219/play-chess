/**
 * Game Timeout Service
 *
 * Manages game timeouts using Bull queue for distributed timeout handling.
 * Supports timeout scheduling, cancellation, and fallback sweeps.
 */

import { Color } from '@workspace/db';
import Bull from 'bull';
import { gameTimeoutQueue } from '../timeouts';

export interface TimeoutJob {
  gameId: string;
  playerId: string;
  color: Color;
  expectedTimeoutAt: number;
}

// Bull queue for timeout jobs
const timeoutQueue: Bull.Queue<TimeoutJob> = gameTimeoutQueue;

/**
 * Schedule a timeout job for when a player's time expires
 */
export async function scheduleTimeoutJob(
  gameId: string,
  playerId: string,
  color: Color,
  timeLeft: number,
): Promise<void> {
  // Don't schedule if time is already up
  if (timeLeft <= 0) {
    return;
  }

  // Add buffer for network latency and processing
  const buffer = 500; // 500ms buffer
  const delay = Math.max(0, timeLeft - buffer);

  const expectedTimeoutAt = Date.now() + timeLeft;

  await timeoutQueue.add(
    {
      gameId,
      playerId,
      color,
      expectedTimeoutAt,
    },
    {
      delay,
      jobId: `timeout:${gameId}:${playerId}`, // Idempotent job ID
    },
  );

  console.log(`[Timeout] Scheduled for ${gameId}, player ${playerId} in ${timeLeft}ms`);
}

/**
 * Cancel timeout job for a player (when they make a move)
 */
export async function cancelTimeoutJob(gameId: string, playerId: string): Promise<void> {
  const jobId = `timeout:${gameId}:${playerId}`;
  const job = await timeoutQueue.getJob(jobId);

  if (job) {
    await job.remove();
    console.log(`[Timeout] Cancelled for ${gameId}, player ${playerId}`);
  }
}

/**
 * Cancel all timeout jobs for a game
 */
export async function cancelAllTimeoutJobs(
  gameId: string,
  whitePlayerId: string,
  blackPlayerId: string,
): Promise<void> {
  await Promise.all([
    cancelTimeoutJob(gameId, whitePlayerId),
    cancelTimeoutJob(gameId, blackPlayerId),
  ]);
}

/**
 * Get the timeout queue for processing
 */
export function getTimeoutQueue(): Bull.Queue<TimeoutJob> {
  return timeoutQueue;
}

/**
 * Check if a player has timed out based on current state
 */
export function hasPlayerTimedOut(
  currentTurn: Color,
  whiteTimeLeft: number,
  blackTimeLeft: number,
  lastMoveAt: number,
): { timedOut: boolean; playerId?: string } {
  const now = Date.now();
  const elapsed = now - lastMoveAt;

  if (currentTurn === 'w' && elapsed >= whiteTimeLeft) {
    return { timedOut: true };
  }

  if (currentTurn === 'b' && elapsed >= blackTimeLeft) {
    return { timedOut: true };
  }

  return { timedOut: false };
}
