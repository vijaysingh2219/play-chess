'use client';

/**
 * Detects if the user is on macOS
 * @returns true if on macOS, false otherwise
 */
export function isMacOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac/.test(navigator.userAgent);
}

/**
 * Returns the appropriate modifier key symbol based on the OS
 * @returns '⌘' for macOS, 'Ctrl' for others
 */
export function getModifierKey(): string {
  return isMacOS() ? '⌘' : 'Ctrl';
}

/**
 * Returns the appropriate modifier key label for display
 * @returns 'Cmd' for macOS, 'Ctrl' for others
 */
export function getModifierKeyLabel(): string {
  return isMacOS() ? 'Cmd' : 'Ctrl';
}

/**
 * Hook to get OS-specific keyboard information
 */
export function useKeyboardPlatform() {
  const modifierKey = getModifierKey();
  const modifierKeyLabel = getModifierKeyLabel();
  const isMac = isMacOS();

  return {
    isMac,
    modifierKey,
    modifierKeyLabel,
  };
}
