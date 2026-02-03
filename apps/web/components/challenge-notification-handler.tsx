'use client';

import { useChallenge } from '@/hooks/use-challenge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { CheckIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

/**
 * ChallengeNotificationHandler
 *
 * This component listens for incoming challenges and displays them as notifications
 * with accept/decline options. It should be included once in the app layout.
 */
export function ChallengeNotificationHandler() {
  const { receivedChallenge, acceptChallenge, declineChallenge, clearReceivedChallenge } =
    useChallenge();

  React.useEffect(() => {
    if (!receivedChallenge) return;

    // Show toast notification with custom component
    const toastId = toast.custom(
      (t) => (
        <Card className="border-primary/50 bg-card w-full max-w-md border-2 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="relative flex h-2 w-2">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
              </span>
              Challenge from {receivedChallenge.sender.username}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>Rating: {receivedChallenge.sender.rating}</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium">{receivedChallenge.timeControl}</span>
            </CardDescription>
          </CardHeader>

          {receivedChallenge.message && (
            <CardContent className="pb-3">
              <p className="text-muted-foreground text-sm italic">
                &quot;{receivedChallenge.message}&quot;
              </p>
            </CardContent>
          )}

          <CardFooter className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => {
                acceptChallenge(receivedChallenge.challengeId);
                toast.dismiss(t);
              }}
              className="flex-1 font-semibold"
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                declineChallenge(receivedChallenge.challengeId);
                toast.dismiss(t);
              }}
              className="flex-1"
            >
              <XIcon className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </CardFooter>
        </Card>
      ),
      {
        duration: 60000, // 1 minute (challenges expire in 5 minutes)
        onDismiss: () => {
          // Clean up if user dismisses the toast
          clearReceivedChallenge();
        },
        onAutoClose: () => {
          // Auto-decline if not responded
          if (receivedChallenge) {
            declineChallenge(receivedChallenge.challengeId);
          }
        },
      },
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [receivedChallenge, acceptChallenge, declineChallenge, clearReceivedChallenge]);

  // This component doesn't render anything visible
  return null;
}
