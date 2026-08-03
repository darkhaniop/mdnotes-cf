import * as React from 'react';
import { cn } from '@/lib/utils';

export function Separator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="separator" className={cn('bg-[var(--border)] h-px w-full', className)} {...props} />;
}
