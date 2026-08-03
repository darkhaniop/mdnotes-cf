import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { credentialsSchema, type Credentials } from '@shared/schemas/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CredentialsFormProps = {
  submitLabel: string;
  onSubmit: (values: Credentials) => Promise<void>;
  autoComplete: 'current-password' | 'new-password';
};

export function CredentialsForm({ submitLabel, onSubmit, autoComplete }: CredentialsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: standardSchemaResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete={autoComplete} {...register('password')} />
        {errors.password ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Working…' : submitLabel}
      </Button>
    </form>
  );
}
