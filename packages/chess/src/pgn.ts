/**
 * PGN (Portable Game Notation) generation utilities
 *
 * Functions for generating and parsing PGN format chess game records.
 */

import { Chess } from 'chess.js';
import type { GameTerminationReason, Move } from './types';

interface PGNGame {
  id: string;
  moves: Move[];
  winner: 'WHITE' | 'BLACK' | 'DRAW' | null;
  terminationReason?: GameTerminationReason | null;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
  timeControl?: number;
  increment?: number;
  whitePlayer: {
    username?: string | null;
    rating?: number | null;
  };
  blackPlayer: {
    username?: string | null;
    rating?: number | null;
  };
}

interface PGNOptions {
  siteName?: string;
  siteUrl?: string;
}

/**
 * Format a date for PGN format (yyyy.MM.dd)
 */
function formatPGNDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * Format time control for PGN
 */
function formatPGNTimeControl(baseSeconds?: number, incrementSeconds?: number): string {
  if (!baseSeconds) return '-';
  const base = baseSeconds;
  const inc = incrementSeconds ?? 0;
  return `${base}+${inc}`;
}

/**
 * Generate a PGN string from a game
 */
export function generatePGN(game: PGNGame, options: PGNOptions = {}): string {
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
  } else if (game.winner === 'DRAW') {
    resultString = '1/2-1/2';
  } else {
    resultString = '*';
  }

  // Format termination reason
  const termination = game.terminationReason ?? 'Unknown';

  // Format dates
  const startDate = game.startedAt
    ? formatPGNDate(new Date(game.startedAt))
    : formatPGNDate(new Date());
  const endDate = game.endedAt ? formatPGNDate(new Date(game.endedAt)) : startDate;

  // Build PGN header
  const headers = [
    `[Event "Online Game"]`,
    `[Site "${options.siteName ?? 'Chess Platform'}"]`,
    `[Date "${startDate}"]`,
    `[EndDate "${endDate}"]`,
    `[White "${game.whitePlayer?.username ?? 'Unknown'}"]`,
    `[Black "${game.blackPlayer?.username ?? 'Unknown'}"]`,
    `[Result "${resultString}"]`,
    `[WhiteElo "${game.whitePlayer?.rating ?? '?'}"]`,
    `[BlackElo "${game.blackPlayer?.rating ?? '?'}"]`,
    `[TimeControl "${formatPGNTimeControl(game.timeControl, game.increment)}"]`,
    `[Termination "${termination}"]`,
  ];

  // Get the move text from chess.js
  const moveText = chess.pgn({ maxWidth: 80, newline: '\n' }).split('\n\n')[1] ?? '';

  return headers.join('\n') + '\n\n' + moveText + ' ' + resultString;
}

/**
 * Download a PGN file
 */
export function downloadPGN(game: PGNGame, options: PGNOptions = {}): void {
  const pgn = generatePGN(game, options);
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `game-${game.id}.pgn`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
