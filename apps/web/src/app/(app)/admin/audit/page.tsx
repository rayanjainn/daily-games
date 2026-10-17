import type { Metadata } from 'next';
import { desc, eq, modActions, users } from '@everydaily/shared/db';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { db } from '@/server/db';

export const metadata: Metadata = { title: 'Audit log' };

const preview = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
};

/** Append-only record of every moderator action (enforced by a database trigger). */
export default async function AuditPage() {
  const rows = await db()
    .select({
      id: modActions.id,
      action: modActions.action,
      targetType: modActions.targetType,
      targetId: modActions.targetId,
      reason: modActions.reason,
      before: modActions.before,
      after: modActions.after,
      createdAt: modActions.createdAt,
      actor: users.username,
    })
    .from(modActions)
    .leftJoin(users, eq(users.id, modActions.actorId))
    .orderBy(desc(modActions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl">Audit log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The latest 100 moderator actions. Entries can never be edited or deleted.
        </p>
      </div>
      {rows.length ? (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Card lift="none" className="flex flex-col gap-1.5 p-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{r.action}</Badge>
                  <span className="text-ink-soft">
                    {r.targetType} · <code className="text-xs">{r.targetId.slice(0, 8)}</code>
                  </span>
                  <span className="ml-auto text-xs text-ink-soft">
                    <time dateTime={r.createdAt.toISOString()}>
                      {r.createdAt.toISOString().replace('T', ' ').slice(0, 16)} UTC
                    </time>
                  </span>
                </div>
                <p>
                  <span className="font-semibold">{r.actor ?? 'system'}</span>
                  {r.reason ? <span className="text-ink-soft"> · “{r.reason}”</span> : null}
                </p>
                {r.after ? (
                  <p className="break-all font-mono text-xs text-ink-soft">
                    {r.before ? `${preview(r.before)} → ` : ''}
                    {preview(r.after)}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card lift="sm">
          <EmptyState title="Nothing logged yet" level={2} className="py-6">
            Moderator actions will appear here.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
