import { cn } from '@workspace/ui/lib/utils';
import type { CapturedPieceSymbol } from '@workspace/utils/types';
import { Clock, Equal, Minus, Plus } from 'lucide-react';

export {
  formatDuration,
  formatTime,
  formatTimeControl,
  formatTimeControlDisplay,
} from '@workspace/utils/helpers';

export const renderResultIcon = (myColor: 'white' | 'black' | null, result: string | null) => {
  const baseClass = 'size-4 rounded';

  if (!myColor || result === null) {
    return <Clock className={`${baseClass} text-accent bg-yellow-500`} />;
  }

  if (result === 'DRAW') {
    return <Equal className={`${baseClass} bg-muted text-secondary-foreground`} />;
  }

  const isWin =
    (myColor === 'white' && result === 'WHITE_WIN') ||
    (myColor === 'black' && result === 'BLACK_WIN');

  return isWin ? (
    <Plus className={`${baseClass} bg-green-600`} />
  ) : (
    <Minus className={`${baseClass} bg-red-600`} />
  );
};

export const getPlayerIndicatorClass = (color: 'white' | 'black', winner: string | null) => {
  const baseColor = color === 'white' ? 'bg-white' : 'bg-gray-700';
  const isWinner =
    (color === 'white' && winner === 'WHITE_WIN') || (color === 'black' && winner === 'BLACK_WIN');

  return cn(
    'inline-block h-3 w-3 rounded border',
    baseColor,
    isWinner ? 'border-green-500 border-2' : 'border-muted',
  );
};

export function pieceName(piece: CapturedPieceSymbol) {
  const typeMap: Record<string, string> = {
    p: 'pawn',
    r: 'rook',
    n: 'knight',
    b: 'bishop',
    q: 'queen',
    k: 'king',
  };
  return typeMap[piece];
}
