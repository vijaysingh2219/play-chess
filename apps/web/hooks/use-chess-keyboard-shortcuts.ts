import { useCallback, useEffect } from 'react';

export interface KeyboardShortcutActions {
  // Navigation
  onPrevMove?: () => void;
  onNextMove?: () => void;
  onFirstMove?: () => void;
  onLastMove?: () => void;
  onGoToMove?: (moveIndex: number) => void;

  // Playback (replay only)
  onTogglePlay?: () => void;

  // Board controls
  onFlipBoard?: () => void;

  // Selection (live game)
  onDeselectPiece?: () => void;

  // Help
  onShowHelp?: () => void;

  // Context info for conditional logic
  totalMoves?: number;
  currentMoveIndex?: number;
  isReplayMode?: boolean;
  isPromotionDialogOpen?: boolean;
}

interface KeyboardShortcutConfig {
  actions: KeyboardShortcutActions;
  enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in chess games
 * Supports navigation, board controls, and playback
 * Automatically disables when input elements are focused or dialogs are open
 */
export function useChessKeyboardShortcuts({ actions, enabled = true }: KeyboardShortcutConfig) {
  const {
    onPrevMove,
    onNextMove,
    onFirstMove,
    onLastMove,
    onGoToMove,
    onTogglePlay,
    onFlipBoard,
    onDeselectPiece,
    onShowHelp,
    totalMoves = 0,
    isReplayMode = false,
    isPromotionDialogOpen = false,
  } = actions;

  const shouldIgnoreKeypress = useCallback(() => {
    // Ignore if disabled
    if (!enabled) return true;

    // Ignore if promotion dialog is open
    if (isPromotionDialogOpen) return true;

    // Ignore if user is typing in input/textarea
    const activeElement = document.activeElement;
    if (
      activeElement?.tagName === 'INPUT' ||
      activeElement?.tagName === 'TEXTAREA' ||
      activeElement?.getAttribute('contenteditable') === 'true'
    ) {
      return true;
    }

    return false;
  }, [enabled, isPromotionDialogOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (shouldIgnoreKeypress()) return;

      const key = event.key.toLowerCase();
      const ctrlOrCmd = event.ctrlKey || event.metaKey;

      // Help dialog - ? or Ctrl+/
      if (key === '?' || (ctrlOrCmd && key === '/')) {
        event.preventDefault();
        onShowHelp?.();
        return;
      }

      // Navigation - Arrow keys
      if (key === 'arrowright') {
        event.preventDefault();
        onNextMove?.();
        return;
      }

      if (key === 'arrowleft') {
        event.preventDefault();
        onPrevMove?.();
        return;
      }

      if (key === 'arrowup') {
        event.preventDefault();
        onFirstMove?.();
        return;
      }

      if (key === 'arrowdown') {
        event.preventDefault();
        onLastMove?.();
        return;
      }

      // Alternative navigation - Home/End
      if (key === 'home') {
        event.preventDefault();
        onFirstMove?.();
        return;
      }

      if (key === 'end') {
        event.preventDefault();
        onLastMove?.();
        return;
      }

      // Flip board - X
      if (key === 'x') {
        event.preventDefault();
        onFlipBoard?.();
        return;
      }

      // Play/Pause - Space or K (replay mode only)
      if (isReplayMode && (key === ' ' || key === 'k')) {
        event.preventDefault();
        onTogglePlay?.();
        return;
      }

      // Deselect piece - Escape (live game only)
      if (!isReplayMode && key === 'escape') {
        event.preventDefault();
        onDeselectPiece?.();
        return;
      }

      // Jump to move by percentage - Number keys 0-9
      if (!isNaN(Number(key)) && totalMoves > 0 && onGoToMove) {
        const percentage = Number(key) * 10; // 0 = 0%, 1 = 10%, ..., 9 = 90%
        const targetMoveIndex = Math.floor((totalMoves * percentage) / 100);

        // Clamp to valid range
        const clampedIndex = Math.max(-1, Math.min(targetMoveIndex - 1, totalMoves - 1));

        event.preventDefault();
        onGoToMove(clampedIndex);
        return;
      }
    },
    [
      shouldIgnoreKeypress,
      onPrevMove,
      onNextMove,
      onFirstMove,
      onLastMove,
      onGoToMove,
      onTogglePlay,
      onFlipBoard,
      onDeselectPiece,
      onShowHelp,
      totalMoves,
      isReplayMode,
    ],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * List of all available keyboard shortcuts for documentation
 * Keys with platform-specific modifiers will be displayed correctly based on OS
 */
export const KEYBOARD_SHORTCUTS = {
  navigation: [
    { key: '←', description: 'Previous move', contexts: ['replay', 'live'] },
    { key: '→', description: 'Next move', contexts: ['replay', 'live'] },
    { key: '↑', description: 'First move', contexts: ['replay', 'live'] },
    { key: '↓', description: 'Last move', contexts: ['replay', 'live'] },
    { key: 'Home', description: 'First move (alternative)', contexts: ['replay', 'live'] },
    { key: 'End', description: 'Last move (alternative)', contexts: ['replay', 'live'] },
    { key: '0-9', description: 'Jump to move by percentage (0%/10%/...90%)', contexts: ['replay'] },
  ],
  playback: [
    { key: 'Space', description: 'Play/Pause autoplay', contexts: ['replay'] },
    { key: 'K', description: 'Play/Pause autoplay (alternative)', contexts: ['replay'] },
  ],
  board: [{ key: 'X', description: 'Flip board orientation', contexts: ['replay', 'live'] }],
  selection: [{ key: 'Esc', description: 'Deselect piece', contexts: ['live'] }],
  general: [
    { key: '?', description: 'Show keyboard shortcuts', contexts: ['replay', 'live'] },
    {
      key: '$mod+/',
      description: 'Show keyboard shortcuts (alternative)',
      contexts: ['replay', 'live'],
    },
  ],
} as const;
