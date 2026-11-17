// src/components/ui/SectionTitle.tsx — jaotise pealkiri (väike suurtäheline poolpaks): vormi alajaotis, kaardi paneeli jaotis.
import React from 'react';
import { cn } from './cn';
import { sectionTitleClass } from './variants';

export const SectionTitle: React.FC<React.ComponentProps<'div'> & { ruled?: boolean; spaced?: boolean }> = ({
  ruled, spaced, className, ...props
}) => <div data-slot="section-title" className={cn(sectionTitleClass({ ruled, spaced }), className)} {...props} />;
