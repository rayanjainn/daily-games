import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentReportRow } from '@/components/community/content-report-row';
import { ModeratorManager } from '@/components/community/moderator-manager';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  canModerateBoard,
  ensureCommunity,
  isModerator,
  listBoardModerators,
  openContentReports,
} from '@/server/community';
import { requireSession } from '@/server/session';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: 'Board moderation' };

/** A board's reports and moderators, for its moderators and for site moderators. */
export default async function BoardModerationPage({ params }: Props) {
  const [{ slug }, { user }] = await Promise.all([params, requireSession()]);
  const c = await ensureCommunity(slug);
  // A plain 404 for everyone else, so the page isn't advertised.
  if (!c || !(await canModerateBoard(user, c.community.id))) notFound();
  const [reports, moderators] = await Promise.all([
    openContentReports(slug),
    listBoardModerators(c.community.id),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/c/${slug}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {c.community.name}
      </Link>
      <h1 className="text-3xl sm:text-4xl">Moderating {c.community.name}</h1>

      <section aria-labelledby="board-reports-heading" className="flex flex-col gap-3">
        <h2 id="board-reports-heading" className="flex items-center gap-2 text-2xl">
          Reports <Badge tone={reports.length ? 'pop' : 'neutral'}>{reports.length}</Badge>
        </h2>
        {reports.length ? (
          <ul className="flex flex-col gap-3" data-testid="board-reports">
            {reports.map((r) => (
              <ContentReportRow key={r.id} report={r} />
            ))}
          </ul>
        ) : (
          <Card lift="sm">
            <EmptyState title="Nothing reported" className="py-6">
              Posts and comments players report in this board show up here.
            </EmptyState>
          </Card>
        )}
      </section>

      <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="board-mods-heading">
        <h2 id="board-mods-heading" className="text-2xl">
          Moderators
        </h2>
        <ModeratorManager slug={slug} moderators={moderators} canEdit={isModerator(user)} />
      </Card>
    </div>
  );
}
