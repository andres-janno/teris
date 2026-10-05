import React from 'react';
// Ametlikud TERIS logofailid (src/assets/logo ja public/); LOGO.md juhendi järgi.
import horizontalColorSvg from '../assets/logo/teris-horizontal-color.svg?raw';
import verticalColorSvg from '../assets/logo/teris-logo-color.svg?raw';
import horizontalMonoSvg from '../assets/logo/teris-horizontal.svg?raw';
import verticalMonoSvg from '../assets/logo/teris-logo.svg?raw';
import iconColorSvg from '../assets/logo/teris-icon-color.svg?raw';
import iconMonoSvg from '../assets/logo/teris-icon.svg?raw';

export interface TerisLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon';
  monochrome?: boolean;
  className?: string;
}

export const TerisLogo: React.FC<TerisLogoProps> = ({
  variant = 'horizontal',
  monochrome = false,
  className
}) => {
  let svg = horizontalColorSvg;
  if (variant === 'vertical') {
    svg = monochrome ? verticalMonoSvg : verticalColorSvg;
  } else if (variant === 'icon') {
    svg = monochrome ? iconMonoSvg : iconColorSvg;
  } else {
    svg = monochrome ? horizontalMonoSvg : horizontalColorSvg;
  }

  return (
    <span
      className={`teris-logo teris-logo-${variant} ${className ?? ''}`}
      role="img"
      aria-label="TERIS"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
