'use client';

import { ChallengeNotificationHandler } from '@/components/challenge-notification-handler';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { KeyboardShortcutsProvider } from '@/contexts/keyboard-shortcuts-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@workspace/ui/components/sidebar';
import { TooltipProvider } from '@workspace/ui/components/tooltip';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <QueryClientProvider client={queryClient}>
        <KeyboardShortcutsProvider>
          <SidebarProvider>
            <TooltipProvider>
              <AppSidebar />
              <ChallengeNotificationHandler />
              <Toaster richColors />
              {children}
            </TooltipProvider>
          </SidebarProvider>
        </KeyboardShortcutsProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
