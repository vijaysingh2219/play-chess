import { useMutation } from '@tanstack/react-query';
import { signIn } from '@workspace/auth/client';
import { SignInFormValues } from '@workspace/contracts';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const DEFAULT_CALLBACK_URL = '/';

export function useSignIn(callbackUrl: string = DEFAULT_CALLBACK_URL) {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ identifier, password }: SignInFormValues) => {
      // The identifier is an email or a username; route to the matching method.
      const isEmail = identifier.includes('@');
      return isEmail
        ? signIn.email({ email: identifier, password, callbackURL: callbackUrl })
        : signIn.username({ username: identifier, password, callbackURL: callbackUrl });
    },
    onSuccess: (data) => {
      if (data?.error) {
        if (data.error.status === 403 && data.error.code === 'EMAIL_NOT_VERIFIED') {
          // Server (sendOnSignIn) emails a fresh link; point the user to it.
          toast.info(
            "Please verify your email to sign in. We've sent a new verification link to your inbox.",
          );
          return;
        }
        toast.error(data.error.message || 'Something went wrong');
        return;
      }

      const signInData = data.data;
      if ('twoFactorRedirect' in signInData && signInData.twoFactorRedirect === true) {
        toast.info('Two-factor authentication required');
        router.push(`/two-factor?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      toast.success('Signed in successfully!');
    },
    onError: (error: Error) => toast.error(error?.message || 'Something went wrong'),
  });
}
