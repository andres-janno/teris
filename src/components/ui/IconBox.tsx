// src/components/ui/IconBox.tsx — ikoon/emoji ruudus (tehnika kaardid ja registrid). Mõõdud ja toonid: variants.ts.
import React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { iconBoxVariants } from './variants';

export type IconBoxProps = React.ComponentProps<'div'> & VariantProps<typeof iconBoxVariants>;

export const IconBox: React.FC<IconBoxProps> = ({ size, tone, className, ...props }) => (
  <div data-slot="icon-box" className={cn(iconBoxVariants({ size, tone }), className)} {...props} />
);
