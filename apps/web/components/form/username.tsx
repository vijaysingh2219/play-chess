import { isUsernameAvailable } from '@workspace/auth/client';
import { usernameSchema } from '@workspace/contracts';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@workspace/ui/components/input-group';
import { Spinner } from '@workspace/ui/components/spinner';
import { AtSign, Check, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Control, FieldValues, Path, useFormContext, useWatch } from 'react-hook-form';

interface UsernameFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  description?: ReactNode | string;
  autoComplete?: string;
  required?: boolean;
  /** The user's existing username; skips the availability check when unchanged. */
  currentValue?: string;
}

export const UsernameField = <T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'e.g. grandmaster_42',
  description,
  autoComplete = 'username',
  required = true,
  currentValue,
}: UsernameFieldProps<T>) => {
  const { setError, clearErrors } = useFormContext<T>();
  const value = useWatch({ control, name });
  const candidate = typeof value === 'string' ? value : '';

  // The user's own current username is theirs to keep, so don't check it.
  const unchanged =
    currentValue !== undefined && candidate.toLowerCase() === currentValue.toLowerCase();

  // Only check once the value is a valid username format; format errors are
  // reported by the resolver, so skip the network call until it passes.
  const validFormat = !unchanged && usernameSchema.safeParse(candidate).success;

  // The availability result is keyed to the value it was fetched for, so a
  // pending edit always reads as "checking" until its own result lands.
  const [result, setResult] = useState<{ value: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!validFormat) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await isUsernameAvailable({ username: candidate });
      if (cancelled) return;

      const available = !error && !!data?.available;
      setResult({ value: candidate, available });
      if (available) {
        clearErrors(name);
      } else {
        setError(name, { type: 'manual', message: 'This username is already taken.' });
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidate, validFormat, name, setError, clearErrors]);

  const settled = result?.value === candidate;
  const status = !validFormat
    ? 'idle'
    : !settled
      ? 'checking'
      : result.available
        ? 'available'
        : 'taken';

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required && <span className="text-primary">*</span>}
          </FormLabel>
          <FormControl>
            <InputGroup>
              <InputGroupInput
                type="text"
                placeholder={placeholder}
                autoComplete={autoComplete}
                {...field}
              />
              <InputGroupAddon align="inline-start">
                <AtSign />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                {status === 'checking' && <Spinner />}
                {status === 'available' && <Check className="text-green-500" />}
                {status === 'taken' && <X className="text-destructive" />}
              </InputGroupAddon>
            </InputGroup>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
