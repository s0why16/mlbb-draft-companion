import { useId } from 'react';
import type { Rank } from '../types';
import { cn } from '../lib/cn';

/**
 * Original crest inspired by classic MOBA rank emblems. It is deliberately
 * drawn from simple geometry so it stays crisp at every size and can inherit
 * the active rank palette from CSS.
 */
export function RankCrest({
  rank,
  size = 64,
  className,
  muted = false,
}: {
  rank: Rank;
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const gradientId = useId().replace(/[:]/g, '');
  return (
    <svg
      className={cn('rank-crest', muted && 'rank-crest--muted', className)}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      data-rank={rank}
    >
      <defs>
        <linearGradient id={gradientId} x1="26" y1="18" x2="134" y2="142" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--crest-light, #fff4c7)" />
          <stop offset="0.45" stopColor="var(--crest-mid, currentColor)" />
          <stop offset="1" stopColor="var(--crest-deep, #8a5a12)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-soft`} x1="80" y1="24" x2="80" y2="138" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* Outer wings */}
      <path
        d="M45 60 20 48l7 19-17-2 16 19-12 12 30-1 9-19-8-16Z"
        fill={`url(#${gradientId}-soft)`}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.82"
      />
      <path
        d="m115 60 25-12-7 19 17-2-16 19 12 12-30-1-9-19 8-16Z"
        fill={`url(#${gradientId}-soft)`}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.82"
      />

      {/* Crown */}
      <path
        d="m58 38 8-18 10 9 4-15 4 15 10-9 8 18-13 6H71l-13-6Z"
        fill={`url(#${gradientId})`}
        stroke="var(--crest-line, rgba(255,255,255,.7))"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="17" r="3.2" fill="var(--crest-line, #fff)" />

      {/* Shield */}
      <path
        d="M52 52h56v30c0 25-16 42-28 50-12-8-28-25-28-50V52Z"
        fill="rgba(5, 10, 16, 0.55)"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M60 60h40v23c0 18-10 31-20 38-10-7-20-20-20-38V60Z"
        fill={`url(#${gradientId}-soft)`}
        opacity="0.14"
      />

      {/* Star / gem */}
      <path
        d="m80 68 7 16 17 2-13 12 4 18-15-9-15 9 4-18-13-12 17-2 7-16Z"
        fill={`url(#${gradientId})`}
        stroke="var(--crest-line, rgba(255,255,255,.75))"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="90" r="4.5" fill="var(--crest-core, #fff8dc)" opacity="0.9" />

      {/* Laurel ticks */}
      <path d="M40 102c-8 8-12 18-12 28M120 102c8 8 12 18 12 28" stroke="currentColor" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
      <path d="M32 116h-8M128 116h8M36 126h-9M124 126h9" stroke="currentColor" strokeWidth="1.1" opacity="0.32" strokeLinecap="round" />
    </svg>
  );
}
