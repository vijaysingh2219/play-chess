import { openBillingPortal } from '@/lib/subscriptions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import { toast } from 'sonner';

export const useCustomerSubscription = (userId?: string) => {
  return useQuery<boolean>({
    queryKey: ['stripe-customer', userId],
    queryFn: async () => {
      if (!userId) return false;

      const res = await fetch(`/api/stripe/customer?userId=${encodeURIComponent(userId)}`);

      if (!res.ok) {
        if (res.status === 404) return false;
        throw new Error('Failed to fetch customer status');
      }

      const data = await res.json();
      return !!data.customer;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
};

export const useSubscription = (userId?: string) => {
  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return null;

      const res = await authClient.subscription.list({
        query: {
          referenceId: userId,
          customerType: 'user',
        },
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to fetch subscription');
      }

      return res.data?.find((sub) => sub.status === 'active' || sub.status === 'trialing') ?? null;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
};

export const useCreateCustomerMutation = ({
  userId,
  userName,
  userEmail,
  returnUrl,
}: {
  userId?: string;
  userName?: string;
  userEmail?: string;
  returnUrl: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-stripe-customer'],
    mutationFn: async () => {
      if (!userId || !userName || !userEmail) {
        throw new Error('User information is missing');
      }

      const res = await fetch('/api/stripe/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: userName, email: userEmail }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create customer');
      }

      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['stripe-customer', userId] });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await openBillingPortal(userId, returnUrl);

      return data;
    },
    onSuccess: () => {
      toast.success('Success', {
        description: 'Customer account created successfully',
      });
    },
    onError: () => {
      toast.error('Error', {
        description: 'Failed to create customer account',
      });
    },
  });
};

export const useCreateSubscriptionMutation = ({
  userId,
  returnUrl,
}: {
  userId?: string;
  returnUrl: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-subscription'],
    mutationFn: async ({ annual }: { annual: boolean }) => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { data, error } = await authClient.subscription.upgrade({
        plan: 'pro',
        annual,
        referenceId: userId,
        customerType: 'user',
        successUrl: `${returnUrl}?success=true`,
        cancelUrl: `${returnUrl}?canceled=true`,
        disableRedirect: false,
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['subscription', userId],
      });
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message || 'Failed to start checkout process',
      });
    },
  });
};

export const useManageSubscriptionMutation = ({
  userId,
  returnUrl,
}: {
  userId: string | undefined;
  returnUrl: string;
}) => {
  return useMutation({
    mutationKey: ['manage-billing'],
    mutationFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      await openBillingPortal(userId, returnUrl);
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message || 'Failed to access billing portal',
      });
    },
  });
};

export const useCancelSubscriptionMutation = ({
  userId,
  setShowCancelDialog,
  returnUrl,
}: {
  userId: string | undefined;
  setShowCancelDialog: (show: boolean) => void;
  returnUrl: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['cancel-subscription'],
    mutationFn: async ({
      subscriptionId,
      stripeSubscriptionId,
    }: {
      subscriptionId?: string;
      stripeSubscriptionId?: string;
    }) => {
      if (!userId || !subscriptionId) {
        throw new Error('Missing required information');
      }

      const res = await authClient.subscription.cancel({
        referenceId: userId,
        customerType: 'user',
        subscriptionId: stripeSubscriptionId,
        returnUrl,
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to cancel subscription');
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      setShowCancelDialog(false);
      toast.success('Subscription Canceled', {
        description: 'Your subscription will remain active until the end of the billing period.',
      });
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message || 'Failed to cancel subscription',
      });
    },
  });
};

export const useRestoreSubscriptionMutation = ({
  userId,
  subscriptionId,
}: {
  userId?: string;
  subscriptionId?: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['restore-subscription'],
    mutationFn: async () => {
      if (!userId || !subscriptionId) {
        throw new Error('Missing required information');
      }

      const res = await authClient.subscription.restore({
        referenceId: userId,
        customerType: 'user',
        subscriptionId,
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to restore subscription');
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
      toast.success('Subscription Restored', {
        description: 'Your subscription has been reactivated.',
      });
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message || 'Failed to restore subscription',
      });
    },
  });
};
