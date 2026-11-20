// src/components/ui/Dropzone.tsx — faili lohistamise ja valimise kast (asendab .dropzone). Välimus: variants.ts dropzoneClass.
import React from 'react';
import { cn } from './cn';
import { dropzoneClass } from './variants';

export type DropzoneProps = React.ComponentProps<'div'> & { dragging?: boolean; hasFile?: boolean };

export const Dropzone: React.FC<DropzoneProps> = ({ dragging, hasFile, className, ...props }) => (
  <div data-slot="dropzone" className={cn(dropzoneClass({ dragging, hasFile }), className)} {...props} />
);
