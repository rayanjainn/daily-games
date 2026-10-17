import type { ReactNode } from 'react';
import { readableOn } from '@everydaily/shared/color';
import type { IconKey } from '@everydaily/shared/registry';
import { cn } from '@/lib/cn';

/**
 * Original game icons: a lifted tile in the game's accent color with a simple motif.
 * Motifs are drawn on a 32×32 grid with `currentColor` so they follow the readable text color.
 */
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
const F = { fill: 'currentColor' } as const;

const MOTIFS: Record<IconKey, ReactNode> = {
  grid: (
    <>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={6 + c * 7}
            y={6 + r * 7}
            width="5.5"
            height="5.5"
            rx="1.4"
            {...(r === 2 ? F : S)}
            strokeWidth={1.8}
          />
        )),
      )}
    </>
  ),
  'grid-multi': (
    <>
      {[0, 1].map((r) =>
        [0, 1].map((c) => (
          <rect key={`${r}${c}`} x={6 + c * 11} y={6 + r * 11} width="9" height="9" rx="2" {...S} />
        )),
      )}
      <rect x="8.5" y="8.5" width="4" height="4" rx="1" {...F} />
      <rect x="19.5" y="19.5" width="4" height="4" rx="1" {...F} />
    </>
  ),
  link: (
    <>
      <rect x="5" y="11" width="12" height="10" rx="5" {...S} />
      <rect x="15" y="11" width="12" height="10" rx="5" {...S} />
    </>
  ),
  strands: <path d="M7 24c3-8 6-8 8-4s5 4 6-4 4-8 5-8" {...S} />,
  'mini-grid': (
    <>
      <rect x="6" y="6" width="20" height="20" rx="3" {...S} />
      <path d="M13 6v20M19 6v20M6 13h20M6 19h20" {...S} strokeWidth={1.6} />
      <rect x="6.8" y="6.8" width="5.4" height="5.4" {...F} />
    </>
  ),
  crossword: (
    <>
      <rect x="6" y="6" width="20" height="20" rx="3" {...S} />
      <path d="M11 6v20M16 6v20M21 6v20M6 11h20M6 16h20M6 21h20" {...S} strokeWidth={1.3} />
      <rect x="11" y="11" width="5" height="5" {...F} />
      <rect x="16" y="21" width="5" height="5" {...F} />
    </>
  ),
  hexagon: <path d="M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11z M16 12l3.5 2v4L16 20l-3.5-2v-4z" {...S} />,
  'square-box': (
    <>
      <rect x="7" y="7" width="18" height="18" rx="2" {...S} />
      {[11, 16, 21].map((p) => (
        <g key={p}>
          <circle cx={p} cy="7" r="1.6" {...F} />
          <circle cx={p} cy="25" r="1.6" {...F} />
          <circle cx="7" cy={p} r="1.6" {...F} />
          <circle cx="25" cy={p} r="1.6" {...F} />
        </g>
      ))}
      <path d="M11 7l10 18M7 16h18" {...S} strokeWidth={1.6} />
    </>
  ),
  tiles: (
    <>
      <rect x="6" y="6" width="9" height="9" rx="2" {...S} />
      <rect x="17" y="6" width="9" height="9" rx="2" {...F} />
      <rect x="6" y="17" width="9" height="9" rx="2" {...F} />
      <rect x="17" y="17" width="9" height="9" rx="2" {...S} />
    </>
  ),
  sudoku: (
    <>
      <rect x="6" y="6" width="20" height="20" rx="3" {...S} />
      <path d="M12.7 6v20M19.3 6v20M6 12.7h20M6 19.3h20" {...S} strokeWidth={1.6} />
      <path d="M15 14.8l1.4-1v5" {...S} strokeWidth={1.6} />
    </>
  ),
  globe: (
    <>
      <circle cx="16" cy="16" r="10" {...S} />
      <path d="M6 16h20M16 6c-5 5-5 15 0 20M16 6c5 5 5 15 0 20" {...S} strokeWidth={1.8} />
    </>
  ),
  pin: (
    <>
      <path d="M16 27s-8-7.5-8-13a8 8 0 0116 0c0 5.5-8 13-8 13z" {...S} />
      <circle cx="16" cy="14" r="3" {...F} />
    </>
  ),
  flag: (
    <>
      <path d="M8 27V6" {...S} />
      <path d="M8 7h15l-3 5 3 5H8" {...S} />
      <path d="M8 7h7.5v10H8z" {...F} />
    </>
  ),
  compass: (
    <>
      <circle cx="16" cy="16" r="10" {...S} />
      <path d="M19.5 12.5l-2 5-5 2 2-5z" {...F} />
    </>
  ),
  route: (
    <>
      <circle cx="9" cy="23" r="3" {...S} />
      <circle cx="23" cy="9" r="3" {...F} />
      <path d="M11.5 21.5c4-1 2-7 6-8.5" {...S} strokeDasharray="2 3" />
    </>
  ),
  trade: (
    <>
      <rect x="7" y="17" width="5" height="8" rx="1" {...F} />
      <rect x="14" y="12" width="5" height="13" rx="1" {...S} />
      <rect x="21" y="7" width="5" height="18" rx="1" {...F} />
    </>
  ),
  equation: <path d="M7 11h6M10 8v6M19 11h6M7 21h6M19 19.5h6M19 23h6" {...S} />,
  calculator: (
    <>
      <rect x="8" y="5" width="16" height="22" rx="3" {...S} />
      <rect x="11" y="8" width="10" height="5" rx="1" {...F} />
      {[17, 22].map((y) =>
        [12, 16, 20].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" {...F} />),
      )}
    </>
  ),
  brain: (
    <path
      d="M16 8v17M16 8c-2-3-7-2-7 2-3 0-4 4-2 6-2 2-1 6 2 6 0 3 5 4 7 1M16 8c2-3 7-2 7 2 3 0 4 4 2 6 2 2 1 6-2 6 0 3-5 4-7 1"
      {...S}
    />
  ),
  question: (
    <>
      <path d="M11.5 12a4.5 4.5 0 119 0c0 3-4.5 3.5-4.5 7" {...S} />
      <circle cx="16" cy="24" r="1.8" {...F} />
    </>
  ),
  cryptic: (
    <>
      <path d="M11 14v-3a5 5 0 0110 0v3" {...S} />
      <rect x="7.5" y="14" width="17" height="12" rx="3" {...S} />
      <circle cx="16" cy="19" r="1.8" {...F} />
      <path d="M16 20v3" {...S} strokeWidth={2} />
    </>
  ),
  film: (
    <>
      <rect x="6" y="8" width="20" height="16" rx="2" {...S} />
      <path d="M11 8v16M21 8v16" {...S} strokeWidth={1.8} />
      {[11, 16, 21].map((y) => (
        <g key={y}>
          <rect x="7.6" y={y - 1} width="2" height="2" {...F} />
          <rect x="22.4" y={y - 1} width="2" height="2" {...F} />
        </g>
      ))}
    </>
  ),
  music: (
    <>
      <path d="M13 22V9l11-3v13" {...S} />
      <circle cx="10.5" cy="22" r="3" {...F} />
      <circle cx="21.5" cy="19" r="3" {...F} />
    </>
  ),
  note: (
    <>
      <path d="M17 21V7c3 1 5 3 6 5" {...S} />
      <ellipse cx="13" cy="21.5" rx="4" ry="3.2" {...F} />
    </>
  ),
  gamepad: (
    <>
      <path
        d="M10 11h12a5 5 0 015 5v1a4 4 0 01-7 2.5l-1-1.5h-6l-1 1.5A4 4 0 015 17v-1a5 5 0 015-5z"
        {...S}
      />
      <path d="M10.5 14v4M8.5 16h4" {...S} strokeWidth={1.8} />
      <circle cx="21" cy="15" r="1.3" {...F} />
      <circle cx="23" cy="17.5" r="1.3" {...F} />
    </>
  ),
  clock: (
    <>
      <circle cx="16" cy="16" r="10" {...S} />
      <path d="M16 10v6l4 3" {...S} />
    </>
  ),
  camera: (
    <>
      <path
        d="M6 12a2 2 0 012-2h3l2-3h6l2 3h3a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2z"
        {...S}
      />
      <circle cx="16" cy="17" r="4" {...F} />
    </>
  ),
  crown: <path d="M6 22l2-12 5 5 3-7 3 7 5-5 2 12z M7 25h18" {...S} />,
  palette: (
    <>
      <path
        d="M16 6a10 10 0 100 20c1.5 0 2-1 2-2s-1-2 0-3 2.5 0 4-1 4-3 4-6c0-4.5-4.5-8-10-8z"
        {...S}
      />
      <circle cx="11" cy="14" r="1.8" {...F} />
      <circle cx="15" cy="10.5" r="1.8" {...F} />
      <circle cx="20" cy="11.5" r="1.8" {...F} />
    </>
  ),
  angle: (
    <>
      <path d="M7 25h19M7 25L22 8" {...S} />
      <path d="M14 25a7 7 0 00-2.4-5.3" {...S} />
    </>
  ),
  waffle: (
    <>
      <rect x="6" y="6" width="20" height="20" rx="4" {...S} />
      <path d="M12.7 6v20M19.3 6v20M6 12.7h20M6 19.3h20" {...S} strokeWidth={1.8} />
    </>
  ),
  magnify: (
    <>
      <circle cx="14" cy="14" r="7" {...S} />
      <path d="M19 19l7 7" {...S} strokeWidth={3.4} />
    </>
  ),
  ball: (
    <>
      <circle cx="16" cy="16" r="10" {...S} />
      <path d="M9 9c4 3 4 11 0 14M23 9c-4 3-4 11 0 14" {...S} strokeWidth={1.8} />
    </>
  ),
  brackets: <path d="M11 7H8v18h3M21 7h3v18h-3M13 16h6" {...S} />,
  path: (
    <>
      <path d="M8 24V16h8V8h8" {...S} />
      <circle cx="8" cy="24" r="2.2" {...F} />
      <circle cx="24" cy="8" r="2.2" {...F} />
    </>
  ),
  dots: (
    <>
      {[10, 16, 22].map((y) =>
        [10, 16, 22].map((x) => (
          <circle
            key={`${x}${y}`}
            cx={x}
            cy={y}
            r={(x + y) % 12 === 8 ? 2.6 : 1.8}
            {...((x + y) % 12 === 8 ? F : S)}
            strokeWidth={1.6}
          />
        )),
      )}
    </>
  ),
  price: (
    <>
      <path d="M6 15V7h8l12 12-8 8z" {...S} />
      <circle cx="10.5" cy="11.5" r="1.8" {...F} />
    </>
  ),
  book: (
    <>
      <path d="M16 9c-3-2-7-2-10-1v16c3-1 7-1 10 1 3-2 7-2 10-1V8c-3-1-7-1-10 1z" {...S} />
      <path d="M16 9v16" {...S} />
    </>
  ),
};

const SIZES = {
  xs: 'size-7 rounded-[8px]',
  sm: 'size-10 rounded-[11px]',
  md: 'size-14 rounded-[15px]',
  lg: 'size-20 rounded-[20px]',
} as const;

export function GameIcon({
  icon,
  color,
  size = 'md',
  className,
  label,
}: {
  icon: IconKey;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Accessible name; omit when the game name is shown next to the icon. */
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center border-[length:var(--bw)] border-line shadow-lift-sm',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color, color: readableOn(color) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 32 32" className="size-[72%]" aria-hidden>
        {MOTIFS[icon]}
      </svg>
    </span>
  );
}
