import React from 'react';

// Stiliseeritud viljapea nagu vanadel kolhoosiembleemidel (nt Jõgeva „Maarja“):
// välimine paks V püstiste harudega, peenike sisejoon ja kaks suurt sisemist tera.
// Sama kuju on public/favicon.svg-s.
export const WheatLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="-0.75 0 25.5 25.5"
    fill="currentColor"
    stroke="currentColor"
    strokeLinejoin="miter"
    className={className}
    aria-hidden="true"
  >
    <path d="M1.15 0V12.95L12 23.8L22.85 12.95V0" fill="none" strokeWidth={2.3} />
    <path d="M3.35 0V12.04L12 20.69L20.65 12.04V0" fill="none" strokeWidth={0.9} />
    <polygon points="4.4,3.4 6.2,3.4 11.45,11.2 11.45,18.65 4.4,11.6" stroke="none" />
    <polygon points="19.6,3.4 17.8,3.4 12.55,11.2 12.55,18.65 19.6,11.6" stroke="none" />
  </svg>
);
