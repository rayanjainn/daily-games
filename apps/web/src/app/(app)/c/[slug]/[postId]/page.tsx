import { ArrowLeft, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentMenu } from '@/components/community/content-menu';
import { FlairBadge } from '@/components/community/flair-badge';
import { Spoiler } from '@/components/community/spoiler';
import { VoteButtons } from '@/components/community/vote-buttons';
import { LiveThread } from '@/components/realtime/live-thread';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { isModerator, postView } from '@/server/community';
import { requireSession } from '@/server/session';

type Params = Promise<{ slug: string; postId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { user } = await requireSession();
  const post = await postView(user, (await params).postId);
  return { title: post?.title ?? 'Post' };
}

export default async function PostPage({ params }: { params: Params }) {
  const [{ slug, postId }, { user }] = await Promise.all([params, requireSession()]);
  const post = await postView(user, postId);
  if (!post || post.community.slug !== slug) notFound();
  const mod = isModerator(user);
  const body = post.html ? (
    <div
      className="prose-comment"
      // Rendered server-side from Markdown and passed through an allowlist sanitizer.
      dangerouslySetInnerHTML={{ __html: post.html }}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/c/${slug}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {post.community.name}
      </Link>
      <Card className="flex flex-col gap-3 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          {post.flair ? <FlairBadge flair={post.flair} /> : null}
          {post.isDailyThread ? <Badge tone="sun">Daily thread</Badge> : null}
          {post.spoiler ? <Badge tone="warn">Spoiler</Badge> : null}
          {post.status === 'locked' ? (
            <Badge>
              <Lock aria-hidden /> Locked
            </Badge>
          ) : null}
          {post.status === 'removed' ? <Badge tone="danger">Removed</Badge> : null}
        </div>
        <h1 className="text-2xl sm:text-3xl">{post.title}</h1>
        <p className="text-sm text-ink-soft">
          {post.isDailyThread ? 'Started automatically' : `by ${post.author ?? 'deleted player'}`}
        </p>
        {body ? post.spoiler ? <Spoiler>{body}</Spoiler> : body : null}
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-line-soft pt-3">
          <VoteButtons
            type="post"
            id={post.id}
            score={post.score}
            myVote={post.myVote}
            disabled={post.status === 'removed'}
            label="this post"
          />
          {!post.isDailyThread ? (
            <ContentMenu type="post" id={post.id} mine={post.mine} mod={mod} status={post.status} />
          ) : mod ? (
            <ContentMenu type="post" id={post.id} mine={false} mod status={post.status} />
          ) : null}
        </div>
      </Card>

      <Card asSection className="flex flex-col gap-4 p-5 sm:p-7" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-xl">
          Comments ({post.commentCount})
        </h2>
        {post.hideComments ? (
          <p
            className="rounded-md bg-info-soft p-3 text-sm text-info"
            data-testid="comments-hidden"
          >
            Comments may give away today&apos;s answer, so they stay hidden until you log the
            puzzle. Tap any comment to read it anyway.
          </p>
        ) : null}
        <LiveThread
          postId={post.id}
          comments={post.comments}
          locked={post.status === 'locked'}
          hideBodies={post.hideComments}
          mod={mod}
          selfName={user.displayName ?? user.username}
        />
      </Card>
    </div>
  );
}
