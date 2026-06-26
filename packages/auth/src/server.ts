import { stripe } from '@better-auth/stripe';
import { prisma } from '@workspace/db';
import {
  changeEmailSchema,
  resetPasswordSchema,
  sendAuthEmail,
  verifyEmailSchema,
} from '@workspace/email';
import { getStripe, WEBHOOK_SECRET } from '@workspace/payments/client';
import { PLANS } from '@workspace/payments/plans';
import {
  changeEmailRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
  welcomeEmailRateLimiter,
} from '@workspace/rate-limit';
import { betterAuth, BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor, username } from 'better-auth/plugins';
import { generateUniqueUsername } from './helpers';

export const auth: ReturnType<typeof betterAuth<BetterAuthOptions>> = betterAuth<BetterAuthOptions>(
  {
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        const { data, success, error } = resetPasswordSchema.safeParse({
          name: user.name,
          resetUrl: url,
        });
        if (error || !success) {
          throw new Error('Failed to send password reset email');
        }

        await sendAuthEmail({
          emailType: 'reset-password',
          limiter: resetPasswordRateLimiter,
          user,
          data,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Re-send on an unverified sign-in attempt so username sign-ins (which
      // can't resend client-side) still get a fresh link. Rate-limited via
      // verifyEmailRateLimiter in sendVerificationEmail below.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const { data, success, error } = verifyEmailSchema.safeParse({
          email: user.email,
          name: user.name,
          verificationUrl: url,
        });
        if (error || !success) {
          throw new Error('Failed to send verification email');
        }

        await sendAuthEmail({
          emailType: 'verify-email',
          limiter: verifyEmailRateLimiter,
          user,
          data,
        });
      },
      async afterEmailVerification(user, request) {
        const origin = request ? new URL(request.url).origin : '';

        await sendAuthEmail({
          emailType: 'welcome',
          limiter: welcomeEmailRateLimiter,
          user,
          data: {
            name: user.name,
            getStartedUrl: origin,
          },
        });
      },
    },
    user: {
      additionalFields: {
        // Chess fields. Populated by the game backend; not user-editable on signup.
        rating: {
          type: 'number',
          required: false,
          defaultValue: 1200,
          input: false,
        },
      },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          const { data, success, error } = changeEmailSchema.safeParse({
            currentEmail: user.email,
            newEmail,
            name: user.name,
            verificationUrl: url,
          });
          if (error || !success) {
            throw new Error('Failed to send email change confirmation');
          }

          await sendAuthEmail({
            emailType: 'change-email',
            limiter: changeEmailRateLimiter,
            user,
            data,
          });
        },
      },
      deleteUser: {
        enabled: true,
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Social logins (Google) arrive without a username; derive one.
            if (user.username) return;

            const derived = await generateUniqueUsername(user.email);
            if (!derived) return;

            return { data: { ...user, username: derived, displayUsername: derived } };
          },
        },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        updateUserInfoOnLink: true,
      },
    },
    plugins: [
      stripe({
        stripeClient: getStripe(),
        stripeWebhookSecret: WEBHOOK_SECRET,
        subscription: {
          enabled: true,
          plans: PLANS,
        },
      }),
      twoFactor({
        issuer: 'PlayChess',
      }),
      username(),
    ],
  },
);
