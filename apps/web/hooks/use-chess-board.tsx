'use client';

import { GameState } from '@workspace/utils/types';
import { Chess, type Square } from 'chess.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from 'react-chessboard';

interface UseChessboardOptions {
  gameState: GameState | null;
  yourColor: 'w' | 'b' | null;
  canMove: boolean;
  onMove: (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => void;
}

interface UseChessboardReturn {
  selectedSquare: Square | null;
  legalMoves: Square[];
  pendingPromotion: { from: Square; to: Square } | null;
  highlightStyles: Record<string, React.CSSProperties>;
  onSquareClick: (args: SquareHandlerArgs) => void;
  onPieceDrag: (args: PieceHandlerArgs) => void;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  handlePromotion: (piece: 'q' | 'r' | 'b' | 'n') => void;
  cancelPromotion: () => void;
  deselectPiece: () => void;
}

export function useChessboard(options: UseChessboardOptions): UseChessboardReturn {
  const { gameState, yourColor, canMove, onMove } = options;

  // State
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(
    null,
  );

  // Chess instance for move validation
  const chess = useMemo(
    () =>
      new Chess(
        gameState?.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ),
    [gameState?.currentFen],
  );

  /**
   * Clear selection when it's not player's turn
   */
  useEffect(() => {
    if (!canMove) {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [canMove]);

  /**
   * Check if a move requires promotion
   */
  const isPromotionMove = useCallback(
    (from: Square, to: Square): boolean => {
      const piece = chess.get(from);
      if (!piece || piece.type !== 'p') return false;

      const targetRank = to[1];
      return (
        (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')
      );
    },
    [chess],
  );

  /**
   * Execute a move (with validation)
   */
  const executeMove = useCallback(
    (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
      // Create temporary board for validation
      const tempBoard = new Chess(chess.fen());
      const move = tempBoard.move({ from, to, promotion });

      if (!move) return false;

      // Execute actual move
      onMove(from, to, promotion);

      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);

      return true;
    },
    [chess, onMove],
  );

  /**
   * Handle square click
   */
  const onSquareClick = useCallback(
    (args: SquareHandlerArgs) => {
      const { square } = args;

      // Ignore if game is over or not player's turn
      if (gameState?.status !== 'ONGOING' || !canMove) {
        return;
      }

      // Case 1: Square is a legal move target
      if (selectedSquare && legalMoves.includes(square as Square)) {
        // Check for promotion
        if (isPromotionMove(selectedSquare, square as Square)) {
          setPendingPromotion({ from: selectedSquare, to: square as Square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        // Execute normal move
        executeMove(selectedSquare, square as Square);
        return;
      }

      // Case 2: Square has player's piece - select it
      const piece = chess.get(square as Square);
      if (piece && piece.color === yourColor) {
        setSelectedSquare(square as Square);
        setLegalMoves(
          chess.moves({ square: square as Square, verbose: true }).map((m) => m.to as Square),
        );
        return;
      }

      // Case 3: Empty square or opponent's piece - deselect
      if (selectedSquare) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    },
    [
      gameState?.status,
      canMove,
      selectedSquare,
      legalMoves,
      chess,
      yourColor,
      isPromotionMove,
      executeMove,
    ],
  );

  /**
   * Handle piece drag start
   */
  const onPieceDrag = useCallback(
    (args: PieceHandlerArgs) => {
      const { square } = args;

      // Only allow dragging own pieces
      const piece = chess.get(square as Square);
      if (!canMove || !piece || piece.color !== yourColor) {
        return;
      }

      // Highlight legal moves
      setSelectedSquare(square as Square);
      setLegalMoves(
        chess.moves({ square: square as Square, verbose: true }).map((m) => m.to as Square),
      );
    },
    [canMove, chess, yourColor],
  );

  /**
   * Handle piece drop
   */
  const onPieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;

      // Validate
      if (!canMove || !targetSquare || sourceSquare === targetSquare) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return false;
      }

      // Check for promotion
      if (isPromotionMove(sourceSquare as Square, targetSquare as Square)) {
        setPendingPromotion({
          from: sourceSquare as Square,
          to: targetSquare as Square,
        });
        setSelectedSquare(null);
        setLegalMoves([]);
        return false; // Don't complete drop - wait for promotion choice
      }

      // Execute move
      const success = executeMove(sourceSquare as Square, targetSquare as Square);

      if (!success) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }

      return success;
    },
    [canMove, isPromotionMove, executeMove],
  );

  /**
   * Handle promotion piece selection
   */
  const handlePromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return;

      executeMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
    },
    [pendingPromotion, executeMove],
  );

  /**
   * Cancel pending promotion
   */
  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
  }, []);

  /**
   * Deselect currently selected piece
   */
  const deselectPiece = useCallback(() => {
    setSelectedSquare(null);
  }, []);

  /**
   * Generate highlight styles for squares
   */
  const getHighlightStyles = useCallback((): Record<string, React.CSSProperties> => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight legal moves
    legalMoves.forEach((square) => {
      styles[square] = {
        backgroundImage: 'radial-gradient(circle, rgba(0, 0, 0, 0.1) 25%, transparent 25%)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      };
    });

    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
      };
    }

    // Highlight last move (if exists)
    if (gameState?.moves && gameState.moves.length > 0) {
      const lastMove = gameState.moves[gameState.moves.length - 1];
      if (lastMove && lastMove.from && lastMove.to) {
        styles[lastMove.from] = {
          ...styles[lastMove.from],
          backgroundImage: 'none',
          backgroundColor: 'rgba(155, 199, 0, 0.41)',
        };
        styles[lastMove.to] = {
          ...styles[lastMove.to],
          backgroundImage: 'none',
          backgroundColor: 'rgba(155, 199, 0, 0.41)',
        };
      }
    }

    return styles;
  }, [legalMoves, selectedSquare, gameState?.moves]);

  return {
    selectedSquare,
    legalMoves,
    pendingPromotion,
    highlightStyles: getHighlightStyles(),
    onSquareClick,
    onPieceDrag,
    onPieceDrop,
    handlePromotion,
    cancelPromotion,
    deselectPiece,
  };
}
