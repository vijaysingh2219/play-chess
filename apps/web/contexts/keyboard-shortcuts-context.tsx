'use client';

import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface KeyboardShortcutsContextType {
  showShortcuts: () => void;
  hideShortcuts: () => void;
  toggleShortcuts: () => void;
  isOpen: boolean;
  setContext: (context: 'live' | 'replay') => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<'live' | 'replay'>('live');

  const showShortcuts = useCallback(() => setIsOpen(true), []);
  const hideShortcuts = useCallback(() => setIsOpen(false), []);
  const toggleShortcuts = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard listener for help dialog
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const ctrlOrCmd = event.ctrlKey || event.metaKey;

      // Toggle help dialog - ? or Ctrl+/
      if (key === '?' || (ctrlOrCmd && key === '/')) {
        event.preventDefault();
        toggleShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleShortcuts]);

  const value = {
    showShortcuts,
    hideShortcuts,
    toggleShortcuts,
    isOpen,
    setContext,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsDialog isOpen={isOpen} onClose={hideShortcuts} context={context} />
    </KeyboardShortcutsContext.Provider>
  );
}
