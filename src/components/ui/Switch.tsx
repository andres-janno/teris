// src/components/ui/Switch.tsx — lüliti (sees/väljas seaded).
import React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  className?: string;
  'aria-label'?: string;
}

export const Switch: React.FC<SwitchProps> = ({ className, ...props }) => (
  <SwitchPrimitive.Root
    className={cn(
      'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" />
  </SwitchPrimitive.Root>
);
