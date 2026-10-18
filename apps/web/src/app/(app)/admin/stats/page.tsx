import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { platformStats, type PlatformStats } from '@/server/platform-stats';
import { requireRolePage } from '@/server/roles';

export const metadata: Metadata = { title: 'Platform stats' };
export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);

function Stat({
  label,
  value,
  hint,
  id,
}: {
  label: string;
  value: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="rounded-lg border-2 border-line-soft bg-surface-2/60 p-3" data-testid={id}>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `s-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={id}>
      <Card className="flex flex-col gap-3 p-5">
        <h2 id={id} className="text-xl">
          {title}
        </h2>
        {children}
      </Card>
    </section>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</dl>
);

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span aria-hidden className="block h-2 rounded-full bg-surface-3">
      <span
        className="block h-2 rounded-full bg-pop"
        style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }}
      />
    </span>
  );
}

function Daily({ rows }: { rows: PlatformStats['daily'] }) {
  const max = Math.max(1, ...rows.map((r) => r.activePeople));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm" data-testid="daily-table">
        <caption className="sr-only">The last 14 days</caption>
        <thead className="text-left text-ink-soft">
          <tr>
            <th scope="col" className="py-1 pr-3">
              Day (UTC)
            </th>
            <th scope="col" className="pr-3">
              Active people
            </th>
            <th scope="col" className="pr-3 text-right">
              New
            </th>
            <th scope="col" className="pr-3 text-right">
              Results
            </th>
            <th scope="col" className="pr-3 text-right">
              Posts
            </th>
            <th scope="col" className="text-right">
              Comments
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className="border-t border-line-soft">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {r.day}
              </th>
              <td className="pr-3">
                <span className="flex items-center gap-2">
                  <span className="w-8 tabular-nums">{fmt(r.activePeople)}</span>
                  <span className="w-24">
                    <Bar value={r.activePeople} max={max} />
                  </span>
                </span>
              </td>
              <td className="pr-3 text-right tabular-nums">{fmt(r.newPeople)}</td>
              <td className="pr-3 text-right tabular-nums">{fmt(r.results)}</td>
              <td className="pr-3 text-right tabular-nums">{fmt(r.posts)}</td>
              <td className="text-right tabular-nums">{fmt(r.comments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PlatformStatsPage() {
  await requireRolePage('admin');
  const s = await platformStats();
  const maxPlayers = Math.max(1, ...s.perGame.map((g) => g.players7d));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl sm:text-4xl">Platform stats</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Totals only, no personal details. Updated {new Date(s.generatedAt).toUTCString()}; reload
          for fresh numbers. “Online now” means a signed-in visit in the last 10 minutes.
        </p>
      </div>

      <Block title="People">
        <Grid>
          <Stat id="stat-online" label="Online now" value={fmt(s.people.onlineNow)} />
          <Stat label="Active, 24 hours" value={fmt(s.people.active24h)} />
          <Stat label="Active, 7 days" value={fmt(s.people.active7d)} />
          <Stat label="Active, 30 days" value={fmt(s.people.active30d)} />
          <Stat id="stat-total" label="Accounts" value={fmt(s.people.total)} />
          <Stat label="New, 24 hours" value={fmt(s.people.new24h)} />
          <Stat label="New, 7 days" value={fmt(s.people.new7d)} />
          <Stat label="New, 30 days" value={fmt(s.people.new30d)} />
          <Stat label="Confirmed email" value={fmt(s.people.withEmail)} />
          <Stat label="Push reminders on" value={fmt(s.people.withPush)} />
          <Stat label="Using the extension" value={fmt(s.people.withExtension)} />
          <Stat label="Moderators and admins" value={fmt(s.people.mods)} />
        </Grid>
      </Block>

      <Block title="Play">
        <Grid>
          <Stat id="stat-results" label="Results logged" value={fmt(s.play.results)} />
          <Stat label="Results, 24 hours" value={fmt(s.play.results24h)} />
          <Stat label="Results, 7 days" value={fmt(s.play.results7d)} />
          <Stat label="Solve rate, 7 days" value={pct(s.play.solveRate7d)} />
          <Stat
            label="Games followed"
            value={fmt(s.play.follows)}
            hint={`${s.play.avgFollows} per account`}
          />
          <Stat label="Games in the catalog" value={fmt(s.play.games)} />
          <Stat label="Native games played" value={fmt(s.play.nativePlays)} />
        </Grid>
        <p className="text-sm text-ink-soft" data-testid="by-source">
          By source:{' '}
          {s.play.bySource.length
            ? s.play.bySource.map((b) => `${b.source} ${fmt(b.count)}`).join(' · ')
            : 'nothing yet'}
        </p>
      </Block>

      <Block title="Community and friends">
        <Grid>
          <Stat
            label="Posts"
            value={fmt(s.social.posts)}
            hint={`${fmt(s.social.posts7d)} in 7 days`}
          />
          <Stat
            label="Comments"
            value={fmt(s.social.comments)}
            hint={`${fmt(s.social.comments7d)} in 7 days`}
          />
          <Stat label="Votes" value={fmt(s.social.votes)} />
          <Stat id="stat-posters" label="People posting, 7 days" value={fmt(s.social.posters7d)} />
          <Stat label="Open reports" value={fmt(s.social.openReports)} />
          <Stat label="Removed by moderators" value={fmt(s.social.removed)} />
          <Stat label="Friendships" value={fmt(s.social.friendships)} />
          <Stat
            label="Groups"
            value={fmt(s.social.groups)}
            hint={`${fmt(s.social.groupMembers)} members`}
          />
        </Grid>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm" data-testid="boards-table">
            <caption className="mb-1 text-left font-display font-semibold">
              Busiest boards, last 7 days
            </caption>
            <thead className="text-left text-ink-soft">
              <tr>
                <th scope="col" className="py-1 pr-3">
                  Board
                </th>
                <th scope="col" className="pr-3 text-right">
                  People
                </th>
                <th scope="col" className="pr-3 text-right">
                  Posts
                </th>
                <th scope="col" className="text-right">
                  Comments
                </th>
              </tr>
            </thead>
            <tbody>
              {s.boards.map((b) => (
                <tr key={b.slug} className="border-t border-line-soft">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {b.name}
                  </th>
                  <td className="pr-3 text-right tabular-nums">{fmt(b.people7d)}</td>
                  <td className="pr-3 text-right tabular-nums">{fmt(b.posts7d)}</td>
                  <td className="text-right tabular-nums">{fmt(b.comments7d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title="Last 14 days">
        <Daily rows={s.daily} />
      </Block>

      <Block title="Games">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm" data-testid="games-table">
            <caption className="sr-only">Players per game</caption>
            <thead className="text-left text-ink-soft">
              <tr>
                <th scope="col" className="py-1 pr-3">
                  Game
                </th>
                <th scope="col" className="pr-3">
                  Players, 7 days
                </th>
                <th scope="col" className="pr-3 text-right">
                  Followers
                </th>
                <th scope="col" className="pr-3 text-right">
                  Results, 7 days
                </th>
                <th scope="col" className="pr-3 text-right">
                  Solve rate
                </th>
                <th scope="col" className="text-right">
                  All time
                </th>
              </tr>
            </thead>
            <tbody>
              {s.perGame.map((g) => (
                <tr key={g.slug} className="border-t border-line-soft" data-testid="game-row">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {g.name}
                  </th>
                  <td className="pr-3">
                    <span className="flex items-center gap-2">
                      <span className="w-8 tabular-nums">{fmt(g.players7d)}</span>
                      <span className="w-24">
                        <Bar value={g.players7d} max={maxPlayers} />
                      </span>
                    </span>
                  </td>
                  <td className="pr-3 text-right tabular-nums">{fmt(g.followers)}</td>
                  <td className="pr-3 text-right tabular-nums">{fmt(g.results7d)}</td>
                  <td className="pr-3 text-right tabular-nums">{pct(g.solveRate7d)}</td>
                  <td className="text-right tabular-nums">{fmt(g.resultsTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}
