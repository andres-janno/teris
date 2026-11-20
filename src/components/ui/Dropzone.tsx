// src/components/ui/Dropzone.tsx — faili lohistamise ja valimise kast (asendab .dropzone). Välimus: variants.ts dropzoneClass.
import React from 'react';
import { cn } from './cn';
import { dropzoneClass } from './variants';
import { clickOnActivationKey } from './keyActivation';

export type DropzoneProps = React.ComponentProps<'div'> & { dragging?: boolean; hasFile?: boolean };

/** Fookustatav ja klaviatuurilt (Enter/tühik) aktiveeritav: kutsuja onClick avab failivaliku. */
export const Dropzone: React.FC<DropzoneProps> = ({ dragging, hasFile, className, onKeyDown, ...props }) => (
  <div
    data-slot="dropzone"
    role="button"
    tabIndex={0}
    className={cn(dropzoneClass({ dragging, hasFile }), className)}
    onKeyDown={(e) => {
      onKeyDown?.(e);
      clickOnActivationKey(e);
    }}
    {...props}
  />
);
