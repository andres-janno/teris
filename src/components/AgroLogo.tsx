import React from 'react';
// Ametlikud logofailid (src/assets/logo); värv tuleb CSS `color` kaudu (fill="currentColor").
import horizontalSvg from '../assets/logo/agro-horizontal.svg?raw';
import verticalSvg from '../assets/logo/agro-logo.svg?raw';

export const TerisLogo: React.FC<{ variant: 'horizontal' | 'vertical'; className?: string }> = ({ variant, className }) => (
  <span
    className={`agro-logo agro-logo-${variant} ${className ?? ''}`}
    role="img"
    aria-label="TERIS"
    dangerouslySetInnerHTML={{ __html: variant === 'horizontal' ? horizontalSvg : verticalSvg }}
  />
);

export const AgroLogo = TerisLogo;

