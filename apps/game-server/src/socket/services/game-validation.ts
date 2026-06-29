import { GameType } from '@workspace/contracts';
import { prisma } from '@workspace/db';
import { playerManager } from './player-manager';

const GAME_LIMITS = {
  // Live games (quick match, challenges)
  LIVE: 1,

  // Daily games (1+ day per move)
  DAILY: 10,

  // Correspondence (very slow)
  CORRESPONDENCE: 20,
} as const;

export async function canUserJoinGame(
  userId: string,
  gameType: GameType,
): Promise<{
  allowed: boolean;
  reason?: string;
  activeGames?: string[];
}> {
  // Get user's active games
  const activeGames = await prisma.game.findMany({
    where: {
      OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      status: 'ONGOING',
    },
    select: {
      id: true,
      gameType: true,
      timeControl: true,
    },
  });

  // Filter by game type
  const liveGames = activeGames.filter(
    (game) => game.gameType === 'QUICK_MATCH' || game.gameType === 'CHALLENGE',
  );

  // Check limits
  if (gameType === 'QUICK_MATCH' || gameType === 'CHALLENGE') {
    if (liveGames.length >= GAME_LIMITS.LIVE) {
      return {
        allowed: false,
        reason: `You already have ${liveGames.length} active game(s). Please finish your current game before starting a new one.`,
        activeGames: liveGames.map((g) => g.id),
      };
    }
  }

  // Also check PlayerManager for consistency
  const activeGameId = await playerManager.getUserActiveGame(userId);
  if (activeGameId && gameType !== 'CHALLENGE') {
    // Double-check it exists in database
    const gameExists = activeGames.some((g) => g.id === activeGameId);
    if (gameExists) {
      return {
        allowed: false,
        reason: 'You are already in an active game.',
        activeGames: [activeGameId],
      };
    } else {
      // Clean up stale data
      await playerManager.removeUserActiveGame(userId);
    }
  }

  return { allowed: true };
}

export async function validateMatchmakingEligibility(userId: string): Promise<void> {
  const check = await canUserJoinGame(userId, 'QUICK_MATCH');

  if (!check.allowed) {
    throw new Error(check.reason || 'Cannot join matchmaking');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error('User not found');
  }
}
