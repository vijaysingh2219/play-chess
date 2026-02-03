import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

// Client
export { getStripe } from './client';
export type { Stripe } from './client';

// Plans
export { PLANS } from './plans';
