// src/components/ui/Alert.tsx — teatekast (asendab .alert-box). Toonid ja suurus: variants.ts alertVariants.
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { alertVariants } from './variants';

export type AlertProps = React.ComponentProps<'div'> & VariantProps<typeof alertVariants>;

export const Alert: React.FC<AlertProps> = ({ tone, size, className, ...props }) => (
  <div data-slot="alert" className={cn(alertVariants({ tone, size }), className)} {...props} />
);
