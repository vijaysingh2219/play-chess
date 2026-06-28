'use client';

import { cn } from '@workspace/ui/lib/utils';
import { Chess } from 'chess.js';
import { useEffect, useState } from 'react';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const STEP_MS = 1100; // time each move rests before the next
const HOLD_MS = 3000; // pause on checkmate before looping

// The "Opera Game" — Morphy vs Brunswick & Isouard, Paris 1858: a short, famous
// game ending in a clean checkmate.
// prettier-ignore
const GAME_MOVES = [
  'e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5',
  'Bc4', 'Nf6', 'Qb3', 'Qe7', 'Nc3', 'c6', 'Bg5', 'b5', 'Nxb5', 'cxb5',
  'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6', 'Bxd7+',
  'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#',
] as const;

type PieceColor = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface PieceState {
  id: string;
  color: PieceColor;
  type: PieceType;
  square: string;
  captured: boolean;
}

// All pieces, keyed by a stable id, at one point in the game.
type Frame = Record<string, PieceState>;

function snapshot(pieces: Frame): Frame {
  const copy: Frame = {};
  for (const id in pieces) copy[id] = { ...pieces[id]! };
  return copy;
}

function findIdAt(pieces: Frame, square: string): string | undefined {
  for (const id in pieces) {
    const p = pieces[id]!;
    if (!p.captured && p.square === square) return id;
  }
  return undefined;
}

// Pre-compute every board position once. Each piece keeps a stable id (its
// starting square) so the UI can animate it sliding from frame to frame.
function buildFrames(): Frame[] {
  const chess = new Chess();
  const pieces: Frame = {};

  // board() runs rank 8 (row 0) down to rank 1 (row 7).
  chess.board().forEach((row, rowIndex) => {
    row.forEach((cell, fileIndex) => {
      if (!cell) return;
      const square = `${FILES[fileIndex]}${8 - rowIndex}`;
      pieces[square] = {
        id: square,
        color: cell.color,
        type: cell.type,
        square,
        captured: false,
      };
    });
  });

  const frames: Frame[] = [snapshot(pieces)];

  for (const san of GAME_MOVES) {
    const move = chess.move(san);

    if (move.captured) {
      // En passant captures a pawn offset from the target square.
      let capSquare: string = move.to;
      if (move.isEnPassant()) {
        const file = move.to[0];
        const rank = Number(move.to[1]);
        capSquare = `${file}${move.color === 'w' ? rank - 1 : rank + 1}`;
      }
      const capId = findIdAt(pieces, capSquare);
      if (capId) pieces[capId]!.captured = true;
    }

    const moverId = findIdAt(pieces, move.from);
    if (moverId) {
      pieces[moverId]!.square = move.to;
      if (move.promotion) pieces[moverId]!.type = move.promotion as PieceType;
    }

    // Castling also relocates the rook.
    const backRank = move.color === 'w' ? '1' : '8';
    if (move.isKingsideCastle()) {
      const rookId = findIdAt(pieces, `h${backRank}`);
      if (rookId) pieces[rookId]!.square = `f${backRank}`;
    } else if (move.isQueensideCastle()) {
      const rookId = findIdAt(pieces, `a${backRank}`);
      if (rookId) pieces[rookId]!.square = `d${backRank}`;
    }

    frames.push(snapshot(pieces));
  }

  return frames;
}

const FRAMES = buildFrames();
const ALL_PIECES = Object.values(FRAMES[0]!);

// 'e4' -> column / row on a white-at-bottom board.
function squareToCoords(square: string): { col: number; row: number } {
  return { col: square.charCodeAt(0) - 97, row: 8 - Number(square[1]) };
}

function pieceSrc(piece: PieceState): string {
  return `/pieces/${piece.color}${piece.type}.png`;
}

export function ChessBoard({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const schedule = (i: number) => {
      if (i < FRAMES.length - 1) {
        timer = setTimeout(() => {
          if (cancelled) return;
          setIndex(i + 1);
          schedule(i + 1);
        }, STEP_MS);
        return;
      }
      // Hold on checkmate, then snap back to the start with animation off, so
      // pieces don't slide chaotically across the board on reset.
      timer = setTimeout(() => {
        if (cancelled) return;
        setAnimate(false);
        setIndex(0);
        timer = setTimeout(() => {
          if (cancelled) return;
          setAnimate(true);
          schedule(0);
        }, 50);
      }, HOLD_MS);
    };

    schedule(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const frame = FRAMES[index]!;

  return (
    <div
      className={cn(
        'ring-foreground/10 relative aspect-square w-full overflow-hidden rounded-2xl shadow-2xl ring-1',
        className,
      )}
    >
      {/* Squares + coordinate labels. */}
      <div className="grid h-full w-full grid-cols-8">
        {Array.from({ length: 64 }, (_, i) => {
          const rowIndex = Math.floor(i / 8);
          const colIndex = i % 8;
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const labelClass = cn(
            'absolute text-[8px] font-semibold sm:text-[10px]',
            isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]',
          );
          return (
            <div key={i} className={cn('relative', isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]')}>
              {colIndex === 0 && (
                <span className={cn(labelClass, 'top-0.5 left-1')}>{8 - rowIndex}</span>
              )}
              {rowIndex === 7 && (
                <span className={cn(labelClass, 'right-1 bottom-0')}>{FILES[colIndex]}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Pieces; each slides between squares via a CSS transform. */}
      <div className="absolute inset-0">
        {ALL_PIECES.map((base) => {
          const piece = frame[base.id] ?? base;
          const { col, row } = squareToCoords(piece.square);
          return (
            <div
              key={base.id}
              className="absolute top-0 left-0 flex h-[12.5%] w-[12.5%] items-center justify-center transition-[transform,opacity] duration-700 ease-in-out motion-reduce:transition-none"
              style={{
                transform: `translate(${col * 100}%, ${row * 100}%)`,
                opacity: piece.captured ? 0 : 1,
                zIndex: piece.captured ? 0 : 1,
                transition: animate ? undefined : 'none',
              }}
            >
              {/* Decorative art; plain <img> avoids next/image config for a public asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pieceSrc(piece)}
                alt=""
                draggable={false}
                className="h-[86%] w-[86%] object-contain drop-shadow-sm select-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
