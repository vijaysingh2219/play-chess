import Stripe from 'stripe';
import { keys } from './keys';

const WEBHOOK_SECRET = keys().STRIPE_WEBHOOK_SECRET!;
let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return stripeInstance as unknown as Stripe;
    }

    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-11-17.clover',
    });
  }
  return stripeInstance;
};

// Export the webhook secret for use in webhook handlers
export { WEBHOOK_SECRET };

// Re-export Stripe types for convenience
export type { Stripe };
