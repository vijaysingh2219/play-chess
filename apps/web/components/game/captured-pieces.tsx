'use client';

import Image from 'next/image';
import { useMemo } from 'react';

import { getCapturedPieceSymbols, useCapturedPieces } from '@/hooks/use-captured-pieces';
import { useGameSocket } from '@/hooks/use-game-socket';
import { MoveData } from '@workspace/utils';

type CapturedPieceSymbol = {
  piece: string;
  count: number;
};

function CapturedPieceRow({
  label,
  symbols,
  materialAdvantage,
  showNone = false,
  size = 6,
}: {
  label?: string;
  symbols: CapturedPieceSymbol[];
  materialAdvantage?: number;
  showNone?: boolean;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-muted-foreground w-12 text-sm font-medium">{label}</span>}

      <div className="flex flex-wrap gap-1">
        {symbols.map(({ piece, count }) => (
          <div key={piece} className="relative flex items-center justify-center">
            <Image
              src={piece}
              alt="captured piece"
              className={`h-${size} w-${size} object-contain`}
              draggable={false}
              unoptimized
              width={100}
              height={100}
            />
            {count > 1 && (
              <span className="bg-background text-foreground absolute -bottom-1 -right-1 rounded-full px-1 text-[10px] leading-none">
                {count}
              </span>
            )}
          </div>
        ))}

        {showNone && symbols.length === 0 && (
          <span className="text-muted-foreground text-xs italic">None</span>
        )}
      </div>

      {materialAdvantage && (
        <span className="ml-auto text-sm font-bold text-green-600">+{materialAdvantage}</span>
      )}
    </div>
  );
}

export function CapturedPiecesDisplay({ gameId }: { gameId: string }) {
  const { gameState } = useGameSocket({ gameId });
  const capturedPieces = useCapturedPieces(gameState?.moves || []);

  const whiteSymbols = useMemo(
    () => getCapturedPieceSymbols(capturedPieces.w, 'w'),
    [capturedPieces.w],
  );

  const blackSymbols = useMemo(
    () => getCapturedPieceSymbols(capturedPieces.b, 'b'),
    [capturedPieces.b],
  );

  if (!gameState) return null;

  return (
    <div className="space-y-4">
      <CapturedPieceRow
        label="White"
        symbols={whiteSymbols}
        materialAdvantage={
          capturedPieces.materialAdvantage.color === 'w'
            ? capturedPieces.materialAdvantage.value
            : undefined
        }
      />

      <CapturedPieceRow
        label="Black"
        symbols={blackSymbols}
        materialAdvantage={
          capturedPieces.materialAdvantage.color === 'b'
            ? capturedPieces.materialAdvantage.value
            : undefined
        }
      />
    </div>
  );
}

export function InlineCapturedPieces({ gameId, color }: { gameId: string; color: 'w' | 'b' }) {
  const { gameState } = useGameSocket({ gameId });
  const capturedPieces = useCapturedPieces(gameState?.moves || []);

  const symbols = useMemo(
    () => getCapturedPieceSymbols(capturedPieces[color], color),
    [capturedPieces, color],
  );

  if (!gameState) return null;

  return (
    <CapturedPieceRow
      symbols={symbols}
      size={5}
      materialAdvantage={
        capturedPieces.materialAdvantage.color === color
          ? capturedPieces.materialAdvantage.value
          : undefined
      }
    />
  );
}

export function ReplayCapturedPieces({ moves }: { moves: MoveData[] }) {
  const capturedPieces = useCapturedPieces(moves);

  const whiteSymbols = useMemo(
    () => getCapturedPieceSymbols(capturedPieces.w, 'w'),
    [capturedPieces.w],
  );

  const blackSymbols = useMemo(
    () => getCapturedPieceSymbols(capturedPieces.b, 'b'),
    [capturedPieces.b],
  );

  return (
    <div className="space-y-3">
      <CapturedPieceRow
        label="White"
        symbols={whiteSymbols}
        showNone
        materialAdvantage={
          capturedPieces.materialAdvantage.color === 'w'
            ? capturedPieces.materialAdvantage.value
            : undefined
        }
      />

      <CapturedPieceRow
        label="Black"
        symbols={blackSymbols}
        showNone
        materialAdvantage={
          capturedPieces.materialAdvantage.color === 'b'
            ? capturedPieces.materialAdvantage.value
            : undefined
        }
      />
    </div>
  );
}
