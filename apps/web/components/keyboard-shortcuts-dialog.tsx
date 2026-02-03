'use client';

import { KEYBOARD_SHORTCUTS } from '@/hooks/use-chess-keyboard-shortcuts';
import { useKeyboardPlatform } from '@/hooks/use-keyboard-platform';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Kbd } from '@workspace/ui/components/kbd';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import {
  FlipHorizontal,
  HelpCircle,
  Keyboard,
  MousePointer,
  Navigation,
  PlayCircle,
} from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'replay' | 'live';
}

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
  context = 'live',
}: KeyboardShortcutsDialogProps) {
  const { modifierKey } = useKeyboardPlatform();

  // Filter shortcuts by context
  const filterByContext = (
    shortcuts: readonly { key: string; description: string; contexts: readonly string[] }[],
  ) => {
    return shortcuts.filter((s) => s.contexts.includes(context));
  };

  const navigationShortcuts = filterByContext(KEYBOARD_SHORTCUTS.navigation);
  const playbackShortcuts = filterByContext(KEYBOARD_SHORTCUTS.playback);
  const boardShortcuts = filterByContext(KEYBOARD_SHORTCUTS.board);
  const selectionShortcuts = filterByContext(KEYBOARD_SHORTCUTS.selection);
  const generalShortcuts = filterByContext(KEYBOARD_SHORTCUTS.general);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="h-6 w-6" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-base">
            Master these shortcuts to navigate and control the chess board like a pro
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid gap-6 py-4">
            {/* Navigation Section */}
            {navigationShortcuts.length > 0 && (
              <ShortcutSection
                icon={Navigation}
                title="Navigation"
                shortcuts={navigationShortcuts}
                modifierKey={modifierKey}
              />
            )}

            {/* Playback Section */}
            {playbackShortcuts.length > 0 && (
              <ShortcutSection
                icon={PlayCircle}
                title="Playback Controls"
                shortcuts={playbackShortcuts}
                modifierKey={modifierKey}
              />
            )}

            {/* Board Controls Section */}
            {boardShortcuts.length > 0 && (
              <ShortcutSection
                icon={FlipHorizontal}
                title="Board Controls"
                shortcuts={boardShortcuts}
                modifierKey={modifierKey}
              />
            )}

            {/* Selection Section */}
            {selectionShortcuts.length > 0 && (
              <ShortcutSection
                icon={MousePointer}
                title="Piece Selection"
                shortcuts={selectionShortcuts}
                modifierKey={modifierKey}
              />
            )}

            {/* General Section */}
            {generalShortcuts.length > 0 && (
              <ShortcutSection
                icon={HelpCircle}
                title="General"
                shortcuts={generalShortcuts}
                modifierKey={modifierKey}
              />
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between border-t pt-4">
          <p className="text-muted-foreground text-sm">
            Press <Kbd className="mx-1">?</Kbd> or <Kbd className="mx-1">{modifierKey}</Kbd>
            <span className="mx-1">+</span>
            <Kbd className="mx-1">/</Kbd> to toggle this dialog
          </p>
          <Button onClick={onClose} variant="default">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutRowProps {
  keys: string;
  description: string;
  modifierKey: string;
}

function ShortcutRow({ keys, description, modifierKey }: ShortcutRowProps) {
  // Replace $mod with the platform-specific modifier key
  const platformKeys = keys.replace('$mod', modifierKey);

  // Parse multiple keys (e.g., "Ctrl+/" or "⌘+/")
  const keyParts = platformKeys.split('+').map((k) => k.trim());

  return (
    <div className="bg-card hover:bg-accent group flex items-center justify-between rounded-lg border p-3 transition-colors">
      <span className="text-sm font-medium">{description}</span>
      <div className="flex items-center gap-1">
        {keyParts.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <Kbd className="bg-muted group-hover:bg-background text-xs font-semibold">{key}</Kbd>
            {index < keyParts.length - 1 && (
              <span className="text-muted-foreground text-xs font-bold">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ShortcutSectionProps {
  icon: React.ElementType;
  title: string;
  shortcuts: readonly { key: string; description: string; contexts: readonly string[] }[];
  modifierKey: string;
}

function ShortcutSection({ icon: Icon, title, shortcuts, modifierKey }: ShortcutSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon className="text-primary h-5 w-5" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <ShortcutRow
            key={index}
            keys={shortcut.key}
            description={shortcut.description}
            modifierKey={modifierKey}
          />
        ))}
      </div>
    </div>
  );
}
