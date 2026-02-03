import { stripeClient } from '@better-auth/stripe/client';
import { twoFactorClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { keys } from './keys';

export const authClient = createAuthClient({
  baseURL: keys().NEXT_PUBLIC_BASE_URL,
  plugins: [
    stripeClient({
      subscription: true,
    }),
    twoFactorClient(),
    usernameClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  revokeSession,
  sendVerificationEmail,
  listAccounts,
  linkSocial,
  unlinkAccount,
  twoFactor,
  changePassword,
  changeEmail,
  updateUser,
  deleteUser,
  requestPasswordReset,
  resetPassword,
  isUsernameAvailable,
  subscription,
  $Infer,
} = authClient;

// Export the inferred session type for use in client components
export type Session = typeof authClient.$Infer.Session;
