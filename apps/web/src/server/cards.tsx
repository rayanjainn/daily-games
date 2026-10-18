import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { DistributionBar, GameStats } from '@everydaily/shared/stats/summary';
import type { MonthRecap } from '@everydaily/shared/stats/month';
import type { WeekPoster } from '@everydaily/shared/stats/week';
import { BRAND } from '@everydaily/shared';

/**
 * Shareable images (stat cards and the weekly poster). They show counts and streaks only,
 * never answers, so they are safe to post. Drawn with the app's light palette and fonts.
 */
interface Palette {
  paper: string;
  surface: string;
  ink: string;
  soft: string;
  line: string;
  lineSoft: string;
  pop: string;
  mint: string;
  danger: string;
  missed: string;
  onFill: string;
  heat: string[];
}
export type CardTheme = 'light' | 'dark';

const LIGHT: Palette = {
  paper: '#FDF2E1',
  surface: '#FFFCF6',
  ink: '#1D1A3A',
  soft: '#57516F',
  line: '#1D1A3A',
  lineSoft: '#E6D6BB',
  pop: '#FF5B2E',
  mint: '#1FC98E',
  danger: '#C01F2C',
  missed: '#EFDCBD',
  onFill: '#1D1A3A',
  heat: ['#EFDCBD', '#A7EBCF', '#5FDBAC', '#1FC98E'],
};
/** Dark cards use the app's dark theme colours. */
const DARK: Palette = {
  paper: '#0F0E1A',
  surface: '#18172A',
  ink: '#F4F2FF',
  soft: '#B9B4D3',
  line: '#8A85A8',
  lineSoft: '#2C2946',
  pop: '#FF7043',
  mint: '#34E3A6',
  danger: '#FF7580',
  missed: '#2C2946',
  /** Text on the green and red tiles and bars. */
  onFill: '#0F0E1A',
  heat: ['#2C2946', '#1E6B54', '#2BB887', '#34E3A6'],
};

const PALETTES: Record<CardTheme, Palette> = { light: LIGHT, dark: DARK };
export const cardTheme = (v: string | null): CardTheme => (v === 'dark' ? 'dark' : 'light');

let fonts: Promise<
  { name: string; data: Buffer; weight: 600 | 700 | 800; style: 'normal' }[]
> | null = null;
function loadFonts() {
  const dir = join(process.cwd(), 'src/assets/fonts');
  fonts ??= Promise.all([
    readFile(join(dir, 'Fredoka-700.ttf')).then((data) => ({
      name: 'Fredoka',
      data,
      weight: 700 as const,
      style: 'normal' as const,
    })),
    readFile(join(dir, 'Nunito-600.ttf')).then((data) => ({
      name: 'Nunito',
      data,
      weight: 600 as const,
      style: 'normal' as const,
    })),
    readFile(join(dir, 'Nunito-800.ttf')).then((data) => ({
      name: 'Nunito',
      data,
      weight: 800 as const,
      style: 'normal' as const,
    })),
  ]);
  return fonts;
}

const headers = {
  'cache-control': 'private, no-store',
  'content-disposition': 'inline',
};

function Brand({ c }: { c: Palette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          width: 44,
          height: 44,
          borderRadius: 12,
          background: c.pop,
          border: `4px solid ${c.line}`,
          boxShadow: `0 4px 0 ${c.line}`,
        }}
      />
      <div style={{ fontFamily: 'Fredoka', fontSize: 34, fontWeight: 700, color: c.ink }}>
        {BRAND.name}
      </div>
    </div>
  );
}

function Stat({ c, label, value }: { c: Palette; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 18px',
        borderRadius: 20,
        background: c.paper,
        minWidth: 138,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: c.soft,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Fredoka',
          fontSize: 56,
          fontWeight: 700,
          color: c.ink,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Bars({ c, bars }: { c: Palette; bars: DistributionBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 420 }}>
      {bars.slice(0, 8).map((b) => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 70,
              fontSize: 22,
              fontWeight: 800,
              color: c.soft,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            {b.label}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              height: 30,
              width: Math.max(36, Math.round((b.count / max) * 320)),
              borderRadius: 10,
              border: `3px solid ${c.line}`,
              background:
                b.count === 0 || b.label === 'Unsolved' || b.label === 'X' ? c.missed : c.mint,
              paddingRight: 8,
              fontSize: 18,
              fontWeight: 800,
              color: b.count === 0 || b.label === 'Unsolved' || b.label === 'X' ? c.ink : c.onFill,
            }}
          >
            {b.count}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 1200×630 card for one game: streaks, totals and the score spread. */
export async function gameCard(input: {
  theme?: CardTheme;
  name: string;
  accentColor: string;
  playerName: string;
  stats: GameStats;
  completion: boolean;
}) {
  const s = input.stats;
  const c = PALETTES[input.theme ?? 'light'];
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: c.paper,
        padding: 40,
        fontFamily: 'Nunito',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: c.surface,
          borderRadius: 32,
          border: `5px solid ${c.line}`,
          boxShadow: `0 10px 0 ${c.line}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: 22,
            background: input.accentColor,
            borderBottom: `5px solid ${c.line}`,
          }}
        />
        <div style={{ display: 'flex', flex: 1, padding: '28px 44px', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontFamily: 'Fredoka',
                  fontSize: 72,
                  fontWeight: 700,
                  color: c.ink,
                  lineHeight: 1,
                }}
              >
                {input.name}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: c.soft, marginTop: 8 }}>
                {`${input.playerName}'s stats`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Stat c={c} label="Streak" value={String(s.streak.current)} />
              <Stat c={c} label="Best" value={String(s.streak.best)} />
              <Stat c={c} label="Played" value={String(s.played)} />
              {input.completion ? null : <Stat c={c} label="Solved" value={`${s.solveRate}%`} />}
            </div>
          </div>
          {!input.completion && s.distribution.length ? <Bars c={c} bars={s.distribution} /> : null}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 44px 26px',
          }}
        >
          <Brand c={c} />
          <div style={{ fontSize: 22, fontWeight: 600, color: c.soft }}>
            everydaily.raycode.tech
          </div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: await loadFonts(), headers },
  );
}

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
const rangeLabel = (days: string[]) => {
  const f = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${f(days[0]!)} – ${f(days[days.length - 1]!)}`;
};

/** 1080×1350 portrait poster of the week, laid out like a game board. */
export async function weekPosterImage(input: {
  theme?: CardTheme;
  playerName: string;
  poster: WeekPoster;
  streak: number;
}) {
  const p = input.poster;
  const c = PALETTES[input.theme ?? 'light'];
  // Name column 210 + 7 tiles and gaps of 8 must fit the 868px inside the card.
  const tile = p.rows.length <= 5 ? 84 : 76;
  const fill = { solved: c.mint, failed: c.danger, missed: c.missed } as const;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: c.paper,
        padding: 48,
        fontFamily: 'Nunito',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: c.surface,
          borderRadius: 40,
          border: `6px solid ${c.line}`,
          boxShadow: `0 12px 0 ${c.line}`,
          padding: '44px 52px',
          gap: 30,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: c.pop,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            My puzzle week
          </div>
          <div
            style={{
              fontFamily: 'Fredoka',
              fontSize: 76,
              fontWeight: 700,
              color: c.ink,
              lineHeight: 1.05,
            }}
          >
            {input.playerName}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: c.soft }}>{rangeLabel(p.days)}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 8, paddingLeft: 218 }}>
            {p.days.map((d) => (
              <div
                key={d}
                style={{
                  display: 'flex',
                  width: tile,
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 800,
                  color: c.soft,
                }}
              >
                {shortDay(d)}
              </div>
            ))}
          </div>
          {p.rows.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 210 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: r.accentColor,
                    border: `3px solid ${c.line}`,
                  }}
                />
                <div
                  style={{
                    fontFamily: 'Fredoka',
                    fontSize: 30,
                    fontWeight: 700,
                    color: c.ink,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name.length > 13 ? `${r.name.slice(0, 12)}…` : r.name}
                </div>
              </div>
              {r.tiles.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    width: tile,
                    height: tile - 18,
                    borderRadius: 14,
                    background: fill[t],
                    border: `4px solid ${t === 'missed' ? c.lineSoft : c.line}`,
                    boxShadow: t === 'missed' ? 'none' : `0 4px 0 ${c.line}`,
                  }}
                />
              ))}
            </div>
          ))}
          {p.rows.length === 0 ? (
            <div style={{ fontSize: 32, color: c.soft }}>Follow some games to fill your board.</div>
          ) : (
            <div style={{ display: 'flex', gap: 28, paddingLeft: 218, marginTop: 12 }}>
              {(
                [
                  ['solved', 'Solved'],
                  ['failed', 'Missed it'],
                  ['missed', 'Not played'],
                ] as const
              ).map(([k, label]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 22,
                    fontWeight: 800,
                    color: c.soft,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: fill[k],
                      border: `3px solid ${k === 'missed' ? c.lineSoft : c.line}`,
                    }}
                  />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Stat c={c} label="Points" value={String(p.points)} />
          <Stat c={c} label="Solved" value={String(p.solved)} />
          <Stat c={c} label="Days" value={`${p.activeDays}/7`} />
          <Stat c={c} label="Streak" value={String(input.streak)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand c={c} />
          <div style={{ fontSize: 24, fontWeight: 600, color: c.soft }}>
            everydaily.raycode.tech
          </div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts: await loadFonts(), headers },
  );
}

const WEEKDAYS = [
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
  'Sundays',
];

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** 1080×1350 portrait poster of a month: a calendar heatmap, totals and the top games. */
export async function monthPosterImage(input: {
  theme?: CardTheme;
  playerName: string;
  recap: MonthRecap;
}) {
  const r = input.recap;
  const c = PALETTES[input.theme ?? 'light'];
  const running = r.elapsed < r.days.length;
  // Monday-first calendar: blank cells before the 1st.
  const lead = (new Date(`${r.days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (number | null | 'blank')[] = [...Array<'blank'>(lead).fill('blank'), ...r.perDay];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const tileW = 108;
  const tileH = weeks.length > 5 ? 52 : 62;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: c.paper,
        padding: 48,
        fontFamily: 'Nunito',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: c.surface,
          borderRadius: 40,
          border: `6px solid ${c.line}`,
          boxShadow: `0 12px 0 ${c.line}`,
          padding: '44px 52px',
          gap: 26,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: c.pop,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            My puzzle month
          </div>
          <div
            style={{
              fontFamily: 'Fredoka',
              fontSize: 72,
              fontWeight: 700,
              color: c.ink,
              lineHeight: 1.05,
            }}
          >
            {input.playerName}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: c.soft }}>
            {`${monthLabel(r.month)}${running ? ' so far' : ''}`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  width: tileW,
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 800,
                  color: c.soft,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} style={{ display: 'flex', gap: 12 }}>
              {w.map((cell, i) => {
                const day = wi * 7 + i - lead + 1;
                if (cell === 'blank')
                  return <div key={i} style={{ display: 'flex', width: tileW }} />;
                const future = cell === null;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      width: tileW,
                      height: tileH,
                      borderRadius: 12,
                      padding: '4px 10px',
                      background: future ? c.surface : c.heat[Math.min(cell, 3)],
                      border: `4px solid ${future || cell === 0 ? c.lineSoft : c.line}`,
                      fontSize: 18,
                      fontWeight: 800,
                      color: future ? c.lineSoft : cell > 0 ? c.onFill : c.ink,
                    }}
                  >
                    {String(day)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Stat c={c} label="Points" value={String(r.points)} />
          <Stat c={c} label="Solved" value={String(r.solved)} />
          <Stat c={c} label="Days" value={`${r.activeDays}/${r.elapsed}`} />
          <Stat c={c} label="Streak" value={String(r.bestStreak)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {r.top.length ? (
            r.top.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 40,
                    fontFamily: 'Fredoka',
                    fontSize: 30,
                    fontWeight: 700,
                    color: c.soft,
                  }}
                >
                  {`${i + 1}.`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: g.accentColor,
                    border: `3px solid ${c.line}`,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    fontFamily: 'Fredoka',
                    fontSize: 32,
                    fontWeight: 700,
                    color: c.ink,
                  }}
                >
                  {g.name.length > 24 ? `${g.name.slice(0, 23)}…` : g.name}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.soft }}>
                  {`${g.played} played · ${g.solved} solved`}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 30, color: c.soft }}>No puzzles logged this month yet.</div>
          )}
          {r.busiestWeekday !== null ? (
            <div style={{ fontSize: 24, fontWeight: 600, color: c.soft, marginTop: 6 }}>
              {`Most puzzles on ${WEEKDAYS[r.busiestWeekday]}`}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand c={c} />
          <div style={{ fontSize: 24, fontWeight: 600, color: c.soft }}>
            everydaily.raycode.tech
          </div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts: await loadFonts(), headers },
  );
}
