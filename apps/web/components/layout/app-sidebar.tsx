'use client';

import { NavUser } from '@/components/layout/nav-user';
import KeyboardShortcutsButton from '@/components/ui/keyboard-shortcuts-button';
import Logo from '@/components/ui/logo';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import { config } from '@/config/site';
import { useKeyboardShortcuts } from '@/contexts/keyboard-shortcuts-context';
import { useChallengesCount } from '@/hooks/queries/challenges';
import { useSubscription } from '@/hooks/subscriptions';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';
import { BadgeCheck, LogIn, Sparkles, Swords, User2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const { user, isAuthenticated } = useAuthUser();
  const { data: subscription } = useSubscription(user?.id);
  const { showShortcuts } = useKeyboardShortcuts();
  const challengesCount = useChallengesCount();
  if (!user) return null;

  const isSidebarExpanded = state === 'expanded';

  const exploreItems = [
    ...config.nav,
    {
      title: 'Challenges',
      href: '/challenges',
      icon: Swords,
    },
    {
      title: 'Stats',
      href: `/member/${user.username}/stats`,
      icon: BadgeCheck,
    },
  ];
  const accountItems = [
    {
      label: 'Public Profile',
      href: `/member/${user.username}`,
      icon: User2,
    },
    ...(subscription
      ? [
          {
            label: 'Manage Membership',
            href: '/membership',
            icon: Sparkles,
          },
        ]
      : [
          {
            label: 'Upgrade to Pro',
            href: '/membership',
            icon: Sparkles,
          },
        ]),
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={`flex ${isSidebarExpanded ? 'flex-row' : 'flex-col'}`}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1">
              <Link href="/" className="flex items-center gap-2 self-center font-medium">
                <Logo variant="sidebar" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarTrigger className="size-8" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {exploreItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title} asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.title === 'Challenges' && challengesCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto flex h-5 w-5 items-center justify-center p-0 text-xs"
                        >
                          {challengesCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton tooltip={item.label} asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {isAuthenticated ? (
          <>
            <KeyboardShortcutsButton onClick={showShortcuts} />
            <ThemeSwitcher />
            <NavUser />
          </>
        ) : (
          <div className={cn('flex flex-col gap-2', { 'self-center': !isSidebarExpanded })}>
            <KeyboardShortcutsButton onClick={showShortcuts} />
            <ThemeSwitcher />
            <Button size={isSidebarExpanded ? 'sm' : 'icon'} aria-label="Sign up">
              <Link
                href="/sign-up"
                className={`flex flex-row items-center justify-center ${isSidebarExpanded ? 'space-x-2' : ''}`}
              >
                <UserPlus className="h-4 w-4" />
                <span>{isSidebarExpanded ? 'Sign up' : ''}</span>
              </Link>
            </Button>
            <Button
              variant="secondary"
              size={isSidebarExpanded ? 'sm' : 'icon'}
              aria-label="Sign in"
            >
              <Link
                href="/sign-in"
                className={`flex flex-row items-center justify-center ${isSidebarExpanded ? 'space-x-2' : ''}`}
              >
                <LogIn className="h-4 w-4" />
                <span>{isSidebarExpanded ? 'Sign in' : ''}</span>
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
