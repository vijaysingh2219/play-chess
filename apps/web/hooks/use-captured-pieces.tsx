'use client';

import { MoveData, PIECE_VALUES } from '@workspace/utils/types';
import { useMemo } from 'react';

/**
 * Captured pieces by color
 */
interface CapturedPieces {
  w: {
    pawns: number;
    knights: number;
    bishops: number;
    rooks: number;
    queens: number;
    total: number;
    materialValue: number;
  };
  b: {
    pawns: number;
    knights: number;
    bishops: number;
    rooks: number;
    queens: number;
    total: number;
    materialValue: number;
  };
  materialAdvantage: {
    color: 'w' | 'b' | 'equal';
    value: number;
  };
}

export function useCapturedPieces(moves: MoveData[]): CapturedPieces {
  return useMemo(() => {
    const captured: CapturedPieces = {
      w: {
        pawns: 0,
        knights: 0,
        bishops: 0,
        rooks: 0,
        queens: 0,
        total: 0,
        materialValue: 0,
      },
      b: {
        pawns: 0,
        knights: 0,
        bishops: 0,
        rooks: 0,
        queens: 0,
        total: 0,
        materialValue: 0,
      },
      materialAdvantage: {
        color: 'equal',
        value: 0,
      },
    };

    // Process each move
    for (const move of moves) {
      if (move.captured) {
        const capturedPiece = move.captured.toLowerCase();
        const capturedBy = move.color;

        // Increment piece count
        switch (capturedPiece) {
          case 'p':
            captured[capturedBy].pawns++;
            break;
          case 'n':
            captured[capturedBy].knights++;
            break;
          case 'b':
            captured[capturedBy].bishops++;
            break;
          case 'r':
            captured[capturedBy].rooks++;
            break;
          case 'q':
            captured[capturedBy].queens++;
            break;
        }

        // Update totals
        captured[capturedBy].total++;
        captured[capturedBy].materialValue +=
          PIECE_VALUES[capturedPiece as keyof typeof PIECE_VALUES] || 0;
      }
    }

    // Calculate material advantage
    const whiteMaterial = captured.w.materialValue;
    const blackMaterial = captured.b.materialValue;
    const advantage = whiteMaterial - blackMaterial;

    if (advantage > 0) {
      captured.materialAdvantage = {
        color: 'w',
        value: advantage,
      };
    } else if (advantage < 0) {
      captured.materialAdvantage = {
        color: 'b',
        value: Math.abs(advantage),
      };
    }

    return captured;
  }, [moves]);
}

/**
 * Get piece symbols for UI display
 */
export function getCapturedPieceSymbols(
  captured: CapturedPieces['w'] | CapturedPieces['b'],
  forColor: 'w' | 'b',
): { piece: string; count: number }[] {
  const symbols: { piece: string; count: number }[] = [];

  // Show captured pieces as PNGs in the opponent's color
  const opponentColor = forColor === 'w' ? 'b' : 'w';
  // Add pieces in order of value (queen, rook, bishop, knight, pawn)
  if (captured.queens > 0)
    symbols.push({ piece: `/pieces/${opponentColor}q.png`, count: captured.queens });
  if (captured.rooks > 0)
    symbols.push({ piece: `/pieces/${opponentColor}r.png`, count: captured.rooks });
  if (captured.bishops > 0)
    symbols.push({ piece: `/pieces/${opponentColor}b.png`, count: captured.bishops });
  if (captured.knights > 0)
    symbols.push({ piece: `/pieces/${opponentColor}n.png`, count: captured.knights });
  if (captured.pawns > 0)
    symbols.push({ piece: `/pieces/${opponentColor}p.png`, count: captured.pawns });
  return symbols;
}
