import { ChallengeDialog } from '@/components/challenge-dialog';
import { defaultTimeControl, TimeControl, timeControls } from '@/lib/time-controls';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { Clock, Timer, Zap } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SearchControlsProps {
  findMatch: (timeControl: string) => void;
  leaveQueue: () => void;
  isSearching: boolean;
}

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

export function SearchControls({ findMatch, leaveQueue, isSearching }: SearchControlsProps) {
  const searchParams = useSearchParams();
  const timeControlParam = searchParams.get('tc');
  const timeControl = timeControls.find((tc) => tc.key === timeControlParam);

  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(
    timeControl || defaultTimeControl,
  );

  useEffect(() => {
    if (!timeControl) return;
    setSelectedTimeControl(timeControl);
  }, [timeControl]);

  const handlePlay = () => {
    findMatch(selectedTimeControl.key);
  };

  return (
    <div className="space-y-4">
      {/* Time Control Grid */}
      <div className="rounded-xl border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Quick Play</h2>
        </div>
        <div className="space-y-4 p-4">
          {timeControlGroups.map((group) => {
            if (group.controls.length === 0) return null;
            const Icon = group.icon;
            return (
              <div key={group.label} className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                  <Icon className="h-3.5 w-3.5" />
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.controls.map((tc) => (
                    <button
                      key={tc.key}
                      onClick={() => setSelectedTimeControl(tc)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
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

        <div className="space-y-3 border-t p-4">
          {isSearching ? (
            <>
              <div className="text-muted-foreground flex items-center justify-center gap-2 text-base">
                <div
                  className="border-primary/30 border-t-primary h-3 w-3 animate-spin rounded-full border-2"
                  aria-hidden="true"
                />
                <span>Searching for {selectedTimeControl.key}...</span>
              </div>
              <Button onClick={leaveQueue} size="lg" variant="outline" className="w-full">
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={handlePlay} size="lg" className="w-full">
              Play {selectedTimeControl.key}
            </Button>
          )}
        </div>
      </div>

      <ChallengeDialog />
    </div>
  );
}
