import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-[var(--input)] bg-transparent flex min-h-16 w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
