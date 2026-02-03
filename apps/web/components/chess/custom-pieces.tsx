'use client';

import Image from 'next/image';
import { JSX } from 'react';

const pieceCodes = ['p', 'n', 'b', 'r', 'q', 'k'] as const;
type PieceColor = 'w' | 'b';

export const customPieces: Record<
  string,
  (props?: { fill?: string; svgStyle?: React.CSSProperties }) => JSX.Element
> = Object.fromEntries(
  (['w', 'b'] as PieceColor[]).flatMap((color) =>
    pieceCodes.map((code) => {
      const pieceId = `${color}${code.toUpperCase()}`; // e.g., wP
      const fileName = `${color}${code}.png`; // e.g., wp.png
      return [
        pieceId,
        () => (
          <Image
            src={`/pieces/${fileName}`}
            alt={pieceId}
            unoptimized
            width={200}
            height={200}
            style={{ width: '100%', height: '100%' }}
          />
        ),
      ] as const;
    }),
  ),
);
