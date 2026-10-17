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
const C = {
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
};

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

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          width: 44,
          height: 44,
          borderRadius: 12,
          background: C.pop,
          border: `4px solid ${C.line}`,
          boxShadow: `0 4px 0 ${C.line}`,
        }}
      />
      <div style={{ fontFamily: 'Fredoka', fontSize: 34, fontWeight: 700, color: C.ink }}>
        {BRAND.name}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 18px',
        borderRadius: 20,
        background: C.paper,
        minWidth: 138,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: C.soft,
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
          color: C.ink,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Bars({ bars }: { bars: DistributionBar[] }) {
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
              color: C.soft,
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
              border: `3px solid ${C.line}`,
              background:
                b.count === 0 || b.label === 'Unsolved' || b.label === 'X' ? C.missed : C.mint,
              paddingRight: 8,
              fontSize: 18,
              fontWeight: 800,
              color: C.ink,
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
  name: string;
  accentColor: string;
  playerName: string;
  stats: GameStats;
  completion: boolean;
}) {
  const s = input.stats;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: C.paper,
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
          background: C.surface,
          borderRadius: 32,
          border: `5px solid ${C.line}`,
          boxShadow: `0 10px 0 ${C.line}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: 22,
            background: input.accentColor,
            borderBottom: `5px solid ${C.line}`,
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
                  color: C.ink,
                  lineHeight: 1,
                }}
              >
                {input.name}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.soft, marginTop: 8 }}>
                {`${input.playerName}'s stats`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Stat label="Streak" value={String(s.streak.current)} />
              <Stat label="Best" value={String(s.streak.best)} />
              <Stat label="Played" value={String(s.played)} />
              {input.completion ? null : <Stat label="Solved" value={`${s.solveRate}%`} />}
            </div>
          </div>
          {!input.completion && s.distribution.length ? <Bars bars={s.distribution} /> : null}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 44px 26px',
          }}
        >
          <Brand />
          <div style={{ fontSize: 22, fontWeight: 600, color: C.soft }}>
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
  playerName: string;
  poster: WeekPoster;
  streak: number;
}) {
  const p = input.poster;
  // Name column 210 + 7 tiles and gaps of 8 must fit the 868px inside the card.
  const tile = p.rows.length <= 5 ? 84 : 76;
  const fill = { solved: C.mint, failed: C.danger, missed: C.missed } as const;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: C.paper,
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
          background: C.surface,
          borderRadius: 40,
          border: `6px solid ${C.line}`,
          boxShadow: `0 12px 0 ${C.line}`,
          padding: '44px 52px',
          gap: 30,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: C.pop,
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
              color: C.ink,
              lineHeight: 1.05,
            }}
          >
            {input.playerName}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: C.soft }}>{rangeLabel(p.days)}</div>
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
                  color: C.soft,
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
                    border: `3px solid ${C.line}`,
                  }}
                />
                <div
                  style={{
                    fontFamily: 'Fredoka',
                    fontSize: 30,
                    fontWeight: 700,
                    color: C.ink,
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
                    border: `4px solid ${t === 'missed' ? C.lineSoft : C.line}`,
                    boxShadow: t === 'missed' ? 'none' : `0 4px 0 ${C.line}`,
                  }}
                />
              ))}
            </div>
          ))}
          {p.rows.length === 0 ? (
            <div style={{ fontSize: 32, color: C.soft }}>Follow some games to fill your board.</div>
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
                    color: C.soft,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: fill[k],
                      border: `3px solid ${k === 'missed' ? C.lineSoft : C.line}`,
                    }}
                  />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Stat label="Played" value={String(p.played)} />
          <Stat label="Solved" value={String(p.solved)} />
          <Stat label="Days" value={`${p.activeDays}/7`} />
          <Stat label="Streak" value={String(input.streak)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ fontSize: 24, fontWeight: 600, color: C.soft }}>
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
/** Calendar tile colour by results that day: none, one, two, three or more. */
const heat = ['#EFDCBD', '#A7EBCF', '#5FDBAC', C.mint];

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** 1080×1350 portrait poster of a month: a calendar heatmap, totals and the top games. */
export async function monthPosterImage(input: { playerName: string; recap: MonthRecap }) {
  const r = input.recap;
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
        background: C.paper,
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
          background: C.surface,
          borderRadius: 40,
          border: `6px solid ${C.line}`,
          boxShadow: `0 12px 0 ${C.line}`,
          padding: '44px 52px',
          gap: 26,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: C.pop,
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
              color: C.ink,
              lineHeight: 1.05,
            }}
          >
            {input.playerName}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: C.soft }}>
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
                  color: C.soft,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} style={{ display: 'flex', gap: 12 }}>
              {w.map((c, i) => {
                const day = wi * 7 + i - lead + 1;
                if (c === 'blank') return <div key={i} style={{ display: 'flex', width: tileW }} />;
                const future = c === null;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      width: tileW,
                      height: tileH,
                      borderRadius: 12,
                      padding: '4px 10px',
                      background: future ? C.surface : heat[Math.min(c, 3)],
                      border: `4px solid ${future || c === 0 ? C.lineSoft : C.line}`,
                      fontSize: 18,
                      fontWeight: 800,
                      color: future ? C.lineSoft : C.ink,
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
          <Stat label="Played" value={String(r.played)} />
          <Stat label="Solved" value={String(r.solved)} />
          <Stat label="Days" value={`${r.activeDays}/${r.elapsed}`} />
          <Stat label="Streak" value={String(r.bestStreak)} />
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
                    color: C.soft,
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
                    border: `3px solid ${C.line}`,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    fontFamily: 'Fredoka',
                    fontSize: 32,
                    fontWeight: 700,
                    color: C.ink,
                  }}
                >
                  {g.name.length > 24 ? `${g.name.slice(0, 23)}…` : g.name}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.soft }}>
                  {`${g.played} played · ${g.solved} solved`}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 30, color: C.soft }}>No puzzles logged this month yet.</div>
          )}
          {r.busiestWeekday !== null ? (
            <div style={{ fontSize: 24, fontWeight: 600, color: C.soft, marginTop: 6 }}>
              {`Most puzzles on ${WEEKDAYS[r.busiestWeekday]}`}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ fontSize: 24, fontWeight: 600, color: C.soft }}>
            everydaily.raycode.tech
          </div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts: await loadFonts(), headers },
  );
}
