import { queryKeys } from '@/lib/query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// TanStack mutation to create Stripe subscription
export const useCreateSubscription = (userEmail: string) => {
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      if (!userEmail) return;
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'price_1S50ESSJsbl9z8Zn1UXUqmlt',
          customerEmail: userEmail,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const responseData = await res.json();
      return responseData;
    },
    onSuccess: (data) => {
      if (data.url) {
        router.push(data.url);
      }
    },
    onError: () => {
      toast.error('Could not initiate checkout. Please try again.');
    },
  });
};

// TanStack mutation to update (cancel/restart) Stripe subscription
export const useUpdateSubscription = (subscriptionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action }: { action: 'CANCEL' | 'RESTART' }) => {
      if (!subscriptionId) throw new Error('No subscription ID provided');
      const res = await fetch('/api/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscriptionId,
          action: action,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      return res.json();
    },
    onSuccess: (variables) => {
      const message =
        variables.action === 'CANCEL'
          ? 'Subscription canceled successfully.'
          : 'Subscription restarted successfully.';
      toast.success(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
    },
    onError: () => {
      toast.error('Could not update subscription. Please try again.');
    },
  });
};
