'use client';

import { Users } from 'lucide-react';

import AddFriendDialog from '@/components/friends/add-friend';
import FriendRequests from '@/components/friends/friend-requests';
import Friends from '@/components/friends/friends';
import PendingRequests from '@/components/friends/pending-requests';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { notFound, useParams, useRouter } from 'next/navigation';

const FriendsPage = () => {
  const { tab } = useParams<{ tab: string }>();
  const router = useRouter();

  const { user } = useRequiredAuthUser();
  if (!user) return null;

  const validTabs = ['pending', 'requests'];
  if (tab && !validTabs.includes(tab)) {
    return notFound();
  }

  function onTabChange(value: string) {
    if (value === 'pending' || value === 'requests') {
      router.push(`/friends/${value}`);
    } else if (value === 'friends') {
      router.push(`/friends`);
    }
  }

  const userId = user.id;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Users className="text-primary h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
          </div>
          <p className="text-muted-foreground">Manage your friends and send challenges</p>
        </div>
        <AddFriendDialog />
      </div>

      {/* Tabs */}
      <Tabs value={tab ?? 'friends'} onValueChange={onTabChange} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          <Friends userId={userId} />
        </TabsContent>

        <TabsContent value="requests">
          <div className="text-muted-foreground">
            <FriendRequests userId={userId} />
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="text-muted-foreground">
            <PendingRequests userId={userId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FriendsPage;
