# @workspace/payments

This package provides payment processing features for the monorepo, including:

- [Stripe](https://stripe.com) integration
- Predefined subscription plans
- Utilities for managing customer subscriptions and billing cycles

## Usage

Import and use payment utilities in your apps:

```ts
import { getStripe } from '@workspace/payments/client';
```

## Features

- Stripe client setup with API key management
- Predefined subscription plans with pricing details
- Utilities for handling customer subscriptions and billing cycles

## Setup

1. Configure Stripe credentials in your environment variables:
   - `STRIPE_API_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID_PRO_MONTHLY`
   - `STRIPE_PRICE_ID_PRO_YEARLY`
2. Use predefined subscription plans or create custom ones as needed.

## Predefined Subscription Plans

The package includes predefined subscription plans:

| Plan          | Price (USD) | Billing Cycle |
| ------------- | ----------- | ------------- |
| `pro_monthly` | $1.99       | Monthly       |
| `pro_yearly`  | $19.99      | Yearly        |

## Example

```ts
import { getStripe } from '@workspace/payments/client';

const customer = await getStripe().customers.retrieve(user.stripeCustomerId);
```
