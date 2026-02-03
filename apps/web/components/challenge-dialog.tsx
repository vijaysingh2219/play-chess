'use client';

import { IUser, useUserProfileSearch } from '@/hooks/queries/user';
import { useSubscription } from '@/hooks/subscriptions';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { useChallenge } from '@/hooks/use-challenge';
import { defaultTimeControl, TimeControl, timeControls } from '@/lib/time-controls';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { cn } from '@workspace/ui/lib/utils';
import debounce from 'lodash.debounce';
import {
  CheckIcon,
  ChevronsUpDownIcon,
  Clock,
  CrownIcon,
  Loader2,
  Search,
  Swords,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

// Group time controls by category
const timeControlGroups = [
  {
    label: 'Bullet',
    icon: Zap,
    controls: timeControls.filter((tc) => {
      const minutes = tc.timer / 60000;
      return minutes < 3;
    }),
  },
  {
    label: 'Blitz',
    icon: Timer,
    controls: timeControls.filter((tc) => {
      const minutes = tc.timer / 60000;
      return minutes >= 3 && minutes < 10;
    }),
  },
  {
    label: 'Rapid',
    icon: Clock,
    controls: timeControls.filter((tc) => {
      const minutes = tc.timer / 60000;
      return minutes >= 10;
    }),
  },
];

export function ChallengeDialog() {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<IUser | null>(null);

  const [selectedTimeControl, setSelectedTimeControl] =
    React.useState<TimeControl>(defaultTimeControl);

  const { user } = useRequiredAuthUser();
  const { data: subscription } = useSubscription(user?.id);
  const { sendChallenge, isSending } = useChallenge();

  const { data: users, isFetching } = useUserProfileSearch({
    username: searchTerm,
    enabled: !!searchTerm && subscription ? true : false,
  });

  const handleSelectUser = (user: IUser) => setSelectedUser(user);

  const handleClearUser = () => {
    setSelectedUser(null);
    setSearchTerm('');
  };

  const handleSubmit = async () => {
    if (!selectedUser) return;

    const timeControlString = selectedTimeControl.key;

    await sendChallenge(selectedUser.id, timeControlString);
    setOpen(false);
    setSelectedUser(null);
    setSearchTerm('');
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      if (subscription) {
        setOpen(true);
      } else {
        toast.info('Pro Feature', {
          description:
            'Challenging players is a Pro feature. Upgrade your membership to unlock this feature.',
        });
      }
    } else {
      setOpen(false);
      setSelectedUser(null);
      setSearchTerm('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className="rounded-xl border">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Challenge Player
              <CrownIcon className="h-4 w-4 text-amber-500" />
            </h2>
          </div>
          <div className="p-4">
            <Button variant="outline" className="text-muted-foreground w-full justify-start gap-2">
              <Search className="h-4 w-4" />
              Search for a player...
            </Button>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="w-full max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Challenge a Player
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          {/* Selected User or Search */}
          {selectedUser ? (
            <div className="bg-muted/30 mb-6 flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.image ?? ''} alt={selectedUser.username} />
                  <AvatarFallback>{selectedUser.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.username}</p>
                  <p className="text-muted-foreground text-sm">Rating: {selectedUser.rating}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearUser} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mb-6">
              <UsernameCombobox
                users={users ?? []}
                value={searchTerm}
                onValueChange={setSearchTerm}
                onSelect={handleSelectUser}
                isLoading={isFetching}
              />
            </div>
          )}

          {/* Time Control Grid */}
          <div className="mb-6 space-y-4">
            <p className="text-sm font-medium">Select Time Control</p>
            {timeControlGroups.map((group) => {
              if (group.controls.length === 0) return null;
              const Icon = group.icon;
              return (
                <div key={group.label} className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                    <Icon className="h-3.5 w-3.5" />
                    {group.label}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {group.controls.map((tc) => (
                      <button
                        key={tc.key}
                        onClick={() => setSelectedTimeControl(tc)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                          'hover:border-primary/50 hover:bg-muted/50',
                          'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
                          selectedTimeControl.key === tc.key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background',
                        )}
                      >
                        {tc.key}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedUser || isSending}
            className="w-full"
            size="lg"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Swords className="mr-2 h-4 w-4" />
                Send Challenge
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface UsernameComboboxProps {
  users: IUser[];
  value: string;
  onValueChange: (val: string) => void;
  onSelect: (user: IUser) => void;
  isLoading?: boolean;
}

export function UsernameCombobox({
  users,
  value,
  onValueChange,
  onSelect,
  isLoading,
}: UsernameComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const debouncedChange = React.useMemo(
    () => debounce((val: string) => onValueChange(val), 300),
    [onValueChange],
  );

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    return () => debouncedChange.cancel();
  }, [debouncedChange]);

  const handleInputChange = (val: string) => {
    setLocalValue(val);
    debouncedChange(val);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className={cn(!localValue && 'text-muted-foreground')}>
            {localValue || 'Search for a player...'}
          </span>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" style={{ width: triggerRef.current?.offsetWidth }}>
        <Command>
          <CommandInput
            placeholder="Type a username..."
            value={localValue}
            onValueChange={handleInputChange}
            autoFocus
          />
          {isLoading && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin" />}
          <CommandList>
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.username}
                  onSelect={() => {
                    onSelect(user);
                    setLocalValue(user.username);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? ''} alt={user.username} />
                    <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user.username}</p>
                    <p className="text-muted-foreground text-xs">Rating: {user.rating}</p>
                  </div>
                  <CheckIcon
                    className={cn(
                      'h-4 w-4',
                      localValue === user.username ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
