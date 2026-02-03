import { authClient } from '@workspace/auth/client';

export { formatDateRange } from '@workspace/utils/helpers';

// Helper function to open billing portal
export async function openBillingPortal(userId: string, returnUrl: string) {
  const { data, error } = await authClient.subscription.billingPortal({
    locale: 'en',
    referenceId: userId,
    customerType: 'user',
    returnUrl,
  });

  if (error) {
    throw new Error(error.message || 'Failed to open billing portal');
  }

  if (data?.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No billing portal URL returned');
  }
}
