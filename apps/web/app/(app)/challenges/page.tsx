'use client';

import { useChallenges } from '@/hooks/queries/challenges';
import { useChallenge } from '@/hooks/use-challenge';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { formatTimeControlDisplay } from '@workspace/utils/helpers';
import { Check, Clock, Swords, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  rating: number;
  image: string;
}

interface Challenge {
  id: string;
  senderId: string;
  receiverId: string;
  sender: User;
  receiver: User;
  timeControl: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

export default function ChallengesPage() {
  const { data: challenges, isLoading } = useChallenges();
  const { acceptChallenge, declineChallenge, cancelChallenge } = useChallenge();

  const handleAccept = async (challengeId: string) => {
    await acceptChallenge(challengeId);
  };

  const handleDecline = async (challengeId: string) => {
    await declineChallenge(challengeId);
  };

  const handleCancel = async (challengeId: string) => {
    await cancelChallenge(challengeId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-1">
        <div className="flex items-center gap-3">
          <Swords className="text-primary h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">Challenges</h1>
        </div>
        <p className="text-muted-foreground">Manage your incoming and outgoing game challenges</p>
      </div>

      <Tabs defaultValue="incoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="incoming" className="relative">
            Incoming
            {challenges && challenges.incoming.length > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 flex h-5 w-5 items-center justify-center p-0"
              >
                {challenges.incoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="relative">
            Outgoing
            {challenges && challenges.outgoing.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 flex h-5 w-5 items-center justify-center p-0"
              >
                {challenges.outgoing.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-6">
          {!challenges || challenges.incoming.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Swords className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground text-center">No incoming challenges</p>
                <p className="text-muted-foreground mt-2 text-center text-sm">
                  When someone challenges you, it will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {challenges.incoming.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  type="incoming"
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-6">
          {!challenges || challenges.outgoing.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Swords className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground text-center">No outgoing challenges</p>
                <p className="text-muted-foreground mt-2 text-center text-sm">
                  Challenge your friends to start a game
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {challenges.outgoing.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  type="outgoing"
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChallengeCard({
  challenge,
  type,
  onAccept,
  onDecline,
  onCancel,
}: {
  challenge: Challenge;
  type: 'incoming' | 'outgoing';
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const opponent = type === 'incoming' ? challenge.sender : challenge.receiver;

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiresAt = new Date(challenge.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [challenge.expiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={opponent.image} alt={opponent.username} />
              <AvatarFallback>{opponent.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{opponent.username}</CardTitle>
              <p className="text-muted-foreground text-sm">Rating: {opponent.rating}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Time Control</span>
            <Badge variant="outline">{formatTimeControlDisplay(challenge.timeControl)}</Badge>
          </div>

          {challenge.message && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1 text-sm">Message</p>
                <p className="text-sm">{challenge.message}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center">
              <Clock className="mr-1 h-4 w-4" />
              Expires in
            </span>
            <span className={`font-mono ${timeLeft < 60 ? 'text-destructive' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {type === 'incoming' ? (
            <div className="flex gap-2 pt-2">
              <Button variant="default" className="flex-1" onClick={() => onAccept?.(challenge.id)}>
                <Check className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onDecline?.(challenge.id)}
              >
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => onCancel?.(challenge.id)}>
              <X className="mr-2 h-4 w-4" />
              Cancel Challenge
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
