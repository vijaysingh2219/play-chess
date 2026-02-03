'use client';

import { useKeyboardPlatform } from '@/hooks/use-keyboard-platform';
import { Button } from '@workspace/ui/components/button';
import { Kbd } from '@workspace/ui/components/kbd';
import { useSidebar } from '@workspace/ui/components/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsButtonProps {
  onClick: () => void;
}

export default function KeyboardShortcutsButton({ onClick }: KeyboardShortcutsButtonProps) {
  const { state } = useSidebar();
  const { modifierKey } = useKeyboardPlatform();

  const isSidebarExpanded = state === 'expanded';

  return (
    <Tooltip>
      <TooltipTrigger asChild className={isSidebarExpanded ? '' : 'self-center'}>
        <Button
          variant={'ghost'}
          size={isSidebarExpanded ? 'sm' : 'icon'}
          aria-label="Keyboard shortcuts"
          className="border"
          onClick={onClick}
        >
          <Keyboard className="h-4 w-4" />
          {isSidebarExpanded ? <span>Shortcuts</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="mb-1">Keyboard Shortcuts</p>
        <div className="flex items-center gap-1">
          <Kbd className="text-xs">?</Kbd>
          <span className="text-muted-foreground text-xs">or</span>
          <Kbd className="text-xs">{modifierKey}</Kbd>
          <span className="text-xs">+</span>
          <Kbd className="text-xs">/</Kbd>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
