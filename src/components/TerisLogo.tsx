import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from './ui';
// Ametlikud TERIS logofailid (src/assets/logo ja public/); LOGO.md juhendi järgi.
import horizontalColorSvg from '../assets/logo/teris-horizontal-color.svg?raw';
import verticalColorSvg from '../assets/logo/teris-logo-color.svg?raw';
import horizontalMonoSvg from '../assets/logo/teris-horizontal.svg?raw';
import verticalMonoSvg from '../assets/logo/teris-logo.svg?raw';
import iconColorSvg from '../assets/logo/teris-icon-color.svg?raw';
import iconMonoSvg from '../assets/logo/teris-icon.svg?raw';

// Logo värvi annab ümbrise tekstivärv (SVG kasutab currentColor); mõõt tuleb SVG-le.
const logoVariants = cva('inline-flex text-primary [&_svg]:block', {
  variants: {
    variant: {
      horizontal: '[&_svg]:h-10 [&_svg]:w-auto [&_svg]:max-w-41.25',
      vertical: '[&_svg]:size-35',
      icon: '[&_svg]:size-9',
      responsive: '[&_svg]:h-10 [&_svg]:w-auto',
    },
  },
});

export interface TerisLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon' | 'responsive';
  monochrome?: boolean;
  responsive?: boolean;
  className?: string;
}

export const TerisLogo: React.FC<TerisLogoProps> = ({
  variant = 'horizontal',
  monochrome = false,
  responsive = false,
  className
}) => {
  const isResponsive = responsive || variant === 'responsive';

  if (isResponsive) {
    const iconSvg = monochrome ? iconMonoSvg : iconColorSvg;
    const horizontalSvg = monochrome ? horizontalMonoSvg : horizontalColorSvg;

    return (
      <span className={cn('inline-flex items-center', className)}>
        {/* Kitsamal ekraanil näidatakse ainult viljapea ikooni ilma TERIS tekstita */}
        <span
          className={cn(logoVariants({ variant: 'icon' }), 'xl:hidden')}
          role="img"
          aria-label="TERIS"
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
        {/* Laiemal ekraanil näidatakse täispikka horisontaalset logo koos TERIS tekstiga */}
        <span
          className={cn(logoVariants({ variant: 'horizontal' }), 'hidden xl:inline-flex')}
          role="img"
          aria-label="TERIS"
          dangerouslySetInnerHTML={{ __html: horizontalSvg }}
        />
      </span>
    );
  }

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
      className={cn(logoVariants({ variant }), className)}
      role="img"
      aria-label="TERIS"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
