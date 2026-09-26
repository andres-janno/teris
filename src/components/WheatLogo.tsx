import React from 'react';

// Stiliseeritud viljapea nagu vanal Haapsalu Ridala kolhoosi embleemil: välimine V-kuju
// püstiste harudega ja kaks sisemist teradepaari. Sama kuju on public/favicon.svg-s.
export const WheatLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 -0.5 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinejoin="miter"
    strokeLinecap="butt"
    className={className}
    aria-hidden="true"
  >
    <path d="M4.4 1V10.8L12 19.4L19.6 10.8V1" />
    <path d="M7.4 8.2L11 12.06M16.6 8.2L13 12.06" />
    <path d="M7.4 2.4L11 6.26M16.6 2.4L13 6.26" />
  </svg>
);
