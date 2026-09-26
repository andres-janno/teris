import React from 'react';

// Viljapea nagu vanadel kolhoosiembleemidel: vars, kolm teradepaari ja ladvatera ohetega.
// Sama kuju on public/favicon.svg-s.
const GRAIN_ROWS = [18.2, 14.2, 10.2];
const ANGLE = 32;
const LEFT_X = 9.5;
const RIGHT_X = 14.5;
const RX = 1.35;
const RY = 2.7;
const RAD = (ANGLE * Math.PI) / 180;
const TIP_DX = RY * Math.sin(RAD);
const TIP_DY = RY * Math.cos(RAD);
const AWN_DX = 3.6 * Math.sin(RAD);
const AWN_DY = 3.6 * Math.cos(RAD);

const awns =
  GRAIN_ROWS.map(
    (cy) =>
      `M${LEFT_X - TIP_DX} ${cy - TIP_DY}l${-AWN_DX} ${-AWN_DY}` +
      `M${RIGHT_X + TIP_DX} ${cy - TIP_DY}l${AWN_DX} ${-AWN_DY}`
  ).join('') + 'M12 3.7V0.5';

export const WheatLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={1.1}
    strokeLinecap="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 23.4V8" fill="none" />
    {GRAIN_ROWS.map((cy) => (
      <g key={cy} stroke="none">
        <ellipse cx={LEFT_X} cy={cy} rx={RX} ry={RY} transform={`rotate(${-ANGLE} ${LEFT_X} ${cy})`} />
        <ellipse cx={RIGHT_X} cy={cy} rx={RX} ry={RY} transform={`rotate(${ANGLE} ${RIGHT_X} ${cy})`} />
      </g>
    ))}
    <ellipse cx={12} cy={6.3} rx={1.3} ry={2.6} stroke="none" />
    <path d={awns} fill="none" strokeWidth={0.9} />
  </svg>
);
