import { prisma } from '@workspace/db';
import { getStripe } from '@workspace/payments/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createStripeCustomerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

const fetchStripeCustomerSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const parsed = fetchStripeCustomerSchema.safeParse({ userId });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid userId parameter' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { stripeCustomerId: true },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ customer: null }, { status: 200 });
    }

    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);

    return NextResponse.json({ customer }, { status: 200 });
  } catch (error) {
    console.error('FetchStripeCustomerError:', error);
    return NextResponse.json({ error: 'Failed to fetch Stripe customer' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { userId, name, email } = createStripeCustomerSchema.parse(payload);

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      name,
      email,
      metadata: { userId },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return NextResponse.json({ stripeCustomerId: customer.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.errors }, { status: 400 });
    }

    console.error('CreateStripeCustomerError:', error);

    return NextResponse.json({ error: 'Failed to create Stripe customer' }, { status: 500 });
  }
}
