import { Winner } from '@workspace/db';

/**
 * K-factor determines how much ratings change per game
 * Higher K = more volatile ratings (good for new players)
 * Lower K = more stable ratings (good for established players)
 */
const K_FACTORS = {
  BEGINNER: 40, // Rating < 1500
  INTERMEDIATE: 32, // Rating 1500-2000
  ADVANCED: 24, // Rating 2000-2400
  MASTER: 16, // Rating > 2400
} as const;

/**
 * Get K-factor based on player rating
 */
function getKFactor(rating: number): number {
  if (rating < 1500) return K_FACTORS.BEGINNER;
  if (rating < 2000) return K_FACTORS.INTERMEDIATE;
  if (rating < 2400) return K_FACTORS.ADVANCED;
  return K_FACTORS.MASTER;
}

/**
 * Calculate expected score for a player
 *
 * Expected score is the probability of winning based on rating difference.
 * Formula: E = 1 / (1 + 10^((opponentRating - playerRating) / 400))
 *
 * @param playerRating - Player's current rating
 * @param opponentRating - Opponent's current rating
 * @returns Expected score (0-1)
 */
function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate actual score based on game result
 *
 * @param winner - Game winner (WHITE, BLACK, or DRAW)
 * @param playerColor - Player's color ('white' or 'black')
 * @returns Actual score (1 = win, 0.5 = draw, 0 = loss)
 */
function calculateActualScore(winner: Winner, playerColor: 'white' | 'black'): number {
  if (winner === 'DRAW') return 0.5;

  const playerWon =
    (winner === 'WHITE' && playerColor === 'white') ||
    (winner === 'BLACK' && playerColor === 'black');

  return playerWon ? 1 : 0;
}

/**
 * Calculate new rating after a game
 *
 * Formula: NewRating = OldRating + K * (ActualScore - ExpectedScore)
 *
 * @param currentRating - Player's current rating
 * @param opponentRating - Opponent's current rating
 * @param actualScore - Game result (1, 0.5, or 0)
 * @returns New rating and rating change
 */
function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  actualScore: number,
): { newRating: number; change: number } {
  const kFactor = getKFactor(currentRating);
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);

  const change = Math.round(kFactor * (actualScore - expectedScore));
  const newRating = currentRating + change;

  return {
    newRating: Math.max(100, newRating), // Minimum rating of 100
    change,
  };
}

/**
 * Calculate ELO changes for both players after a game
 *
 * @param whiteRating - White player's current rating
 * @param blackRating - Black player's current rating
 * @param winner - Game winner
 * @returns Rating changes for both players
 */
export function calculateEloChanges(
  whiteRating: number,
  blackRating: number,
  winner: Winner,
): {
  whiteChange: number;
  blackChange: number;
  whiteNewRating: number;
  blackNewRating: number;
} {
  const whiteActualScore = calculateActualScore(winner, 'white');
  const blackActualScore = calculateActualScore(winner, 'black');

  const whiteResult = calculateNewRating(whiteRating, blackRating, whiteActualScore);

  const blackResult = calculateNewRating(blackRating, whiteRating, blackActualScore);

  return {
    whiteChange: whiteResult.change,
    blackChange: blackResult.change,
    whiteNewRating: whiteResult.newRating,
    blackNewRating: blackResult.newRating,
  };
}

/**
 * Estimate rating change before a game
 * (For UI to show potential rating changes)
 */
export function estimateRatingChange(
  playerRating: number,
  opponentRating: number,
): {
  onWin: number;
  onDraw: number;
  onLoss: number;
} {
  const kFactor = getKFactor(playerRating);
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);

  return {
    onWin: Math.round(kFactor * (1 - expectedScore)),
    onDraw: Math.round(kFactor * (0.5 - expectedScore)),
    onLoss: Math.round(kFactor * (0 - expectedScore)),
  };
}

/**
 * Calculate win probability based on rating difference
 */
export function calculateWinProbability(playerRating: number, opponentRating: number): number {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);
  return Math.round(expectedScore * 100); // Convert to percentage
}

/**
 * Get rating tier/title based on rating
 */
export function getRatingTier(rating: number): string {
  if (rating < 1000) return 'Beginner';
  if (rating < 1200) return 'Novice';
  if (rating < 1400) return 'Intermediate';
  if (rating < 1600) return 'Advanced';
  if (rating < 1800) return 'Expert';
  if (rating < 2000) return 'Candidate Master';
  if (rating < 2200) return 'Master';
  if (rating < 2400) return 'International Master';
  if (rating < 2600) return 'Grandmaster';
  return 'Super Grandmaster';
}
