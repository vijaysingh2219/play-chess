import { keys } from './keys';

export const PLANS = [
  {
    name: 'pro',
    priceId: keys().STRIPE_PRICE_ID_PRO_MONTHLY,
    annualDiscountPriceId: keys().STRIPE_PRICE_ID_PRO_YEARLY,
    limits: {
      challengeFriend: true,
    },
    freeTrial: {
      days: 7,
    },
  },
];
