import { IGame } from '@/components/chess/replay-board';
import { config } from '@/config/site';
import { formatDate, formatTimeControl } from '@workspace/utils/helpers';
import { Chess } from 'chess.js';

export function downloadPGN(game: IGame) {
  const chess = new Chess();

  // Replay all moves to build PGN
  for (const move of game.moves) {
    chess.move(move.san);
  }

  // Determine result string (standard PGN format)
  let resultString: string;
  if (game.winner === 'WHITE') {
    resultString = '1-0';
  } else if (game.winner === 'BLACK') {
    resultString = '0-1';
  } else {
    resultString = '1/2-1/2'; // Draw or null
  }

  // Format termination reason
  const termination = getTerminationString(game);

  // Format dates
  const startDate = game.startedAt
    ? formatDate(new Date(game.startedAt), 'yyyy.MM.dd')
    : formatDate(new Date(), 'yyyy.MM.dd');

  const endDate = game.endedAt ? formatDate(new Date(game.endedAt), 'yyyy.MM.dd') : startDate;

  // Add PGN headers
  chess.header(
    'Event',
    game.gameType === 'CHALLENGE' ? 'Challenge Match' : 'Rated Game',
    'Site',
    config.name,
    'Date',
    startDate,
    'Round',
    '-',
    'White',
    game.whitePlayer.username ?? '?',
    'Black',
    game.blackPlayer.username ?? '?',
    'Result',
    resultString,
  );

  // Additional metadata headers
  chess.header(
    'WhiteElo',
    game.whiteEloAtStart?.toString() ?? '?',
    'BlackElo',
    game.blackEloAtStart?.toString() ?? '?',
    'WhiteRatingDiff',
    game.eloChangeWhite
      ? game.eloChangeWhite > 0
        ? `+${game.eloChangeWhite}`
        : game.eloChangeWhite.toString()
      : '',
    'BlackRatingDiff',
    game.eloChangeBlack
      ? game.eloChangeBlack > 0
        ? `+${game.eloChangeBlack}`
        : game.eloChangeBlack.toString()
      : '',
    'TimeControl',
    formatTimeControl(game.initialTime, game.incrementTime),
    'EndDate',
    endDate,
    'EndTime',
    game.endedAt ? new Date(game.endedAt).toISOString().slice(11, 19) : '',
    'Termination',
    termination,
  );

  if (game.startedAt && game.endedAt) {
    const durationMs = new Date(game.endedAt).getTime() - new Date(game.startedAt).getTime();
    const durationMinutes = Math.floor(durationMs / 1000 / 60);
    chess.header('Duration', `${durationMinutes}min`);
  }

  // Generate PGN string
  const pgn = chess.pgn({ maxWidth: 80, newline: '\n' });

  // Create meaningful filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${game.whitePlayer.username}_vs_${game.blackPlayer.username}_${dateStr}.pgn`;

  // Download file
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link); // Required for Firefox
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get human-readable termination string
 */
function getTerminationString(game: IGame): string {
  if (!game.reason) {
    return 'Game ended';
  }

  const winner = game.winner;
  const loser = winner === 'WHITE' ? 'Black' : winner === 'BLACK' ? 'White' : null;

  switch (game.reason) {
    case 'CHECKMATE':
      return `${winner} won by checkmate`;

    case 'RESIGNATION':
      return `${loser} resigned`;

    case 'TIMEOUT':
      return `${loser} lost on time`;

    case 'STALEMATE':
      return 'Game drawn by stalemate';

    case 'INSUFFICIENT_MATERIAL':
      return 'Game drawn by insufficient material';

    case 'THREEFOLD_REPETITION':
      return 'Game drawn by threefold repetition';

    case 'FIFTY_MOVE_RULE':
      return 'Game drawn by fifty-move rule';

    case 'AGREEMENT':
      return 'Game drawn by agreement';

    default:
      return 'Game ended';
  }
}

/**
 * Copy PGN to clipboard instead of downloading
 */
export function generatePGNString(game: IGame): string {
  const chess = new Chess();

  for (const move of game.moves) {
    chess.move(move.san);
  }

  const resultString =
    game.winner === 'WHITE' ? '1-0' : game.winner === 'BLACK' ? '0-1' : '1/2-1/2';

  const termination = getTerminationString(game);

  const startDate = game.startedAt
    ? formatDate(new Date(game.startedAt), 'yyyy.MM.dd')
    : formatDate(new Date(), 'yyyy.MM.dd');

  chess.header(
    'Event',
    game.gameType === 'CHALLENGE' ? 'Challenge Match' : 'Rated Game',
    'Site',
    config.name,
    'Date',
    startDate,
    'White',
    game.whitePlayer.username ?? '?',
    'Black',
    game.blackPlayer.username ?? '?',
    'Result',
    resultString,
    'WhiteElo',
    game.whiteEloAtStart?.toString() ?? '?',
    'BlackElo',
    game.blackEloAtStart?.toString() ?? '?',
    'TimeControl',
    formatTimeControl(game.initialTime, game.incrementTime),
    'Termination',
    termination,
  );

  const pgn = chess.pgn({ maxWidth: 80, newline: '\n' });

  return pgn;
}
