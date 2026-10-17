'use client';

import { MessageSquareReply } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { buildThread, type CommentNode } from '@everydaily/shared/community/ranking';
import { MAX_COMMENT_BODY } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { CommentView } from '@/server/community';
import { ContentMenu } from './content-menu';
import { Spoiler } from './spoiler';
import { VoteButtons } from './vote-buttons';

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

export function CommentThread({
  postId,
  comments,
  locked,
  hideBodies,
  mod,
}: {
  postId: string;
  comments: CommentView[];
  locked: boolean;
  /** Daily thread the viewer hasn't logged yet: every comment starts blurred. */
  hideBodies: boolean;
  mod: boolean;
}) {
  const tree = buildThread(comments);
  return (
    <div className="flex flex-col gap-4">
      {locked ? (
        <p className="rounded-md bg-warn-soft p-3 text-sm font-semibold text-warn">
          This post is locked. No new comments.
        </p>
      ) : (
        <CommentForm postId={postId} />
      )}
      {tree.length ? (
        <ol className="flex flex-col gap-3" data-testid="comments">
          {tree.map((c) => (
            <Comment
              key={c.id}
              node={c}
              postId={postId}
              locked={locked}
              hideBodies={hideBodies}
              mod={mod}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-soft">No comments yet. Start the conversation.</p>
      )}
    </div>
  );
}

function Comment({
  node,
  postId,
  locked,
  hideBodies,
  mod,
}: {
  node: CommentNode<CommentView>;
  postId: string;
  locked: boolean;
  hideBodies: boolean;
  mod: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const removed = node.status === 'removed';
  const body = node.html ? (
    <div
      className={cn('prose-comment text-sm', removed && 'opacity-60')}
      // Rendered server-side from Markdown and passed through an allowlist sanitizer.
      dangerouslySetInnerHTML={{ __html: node.html }}
    />
  ) : (
    <p className="text-sm italic text-ink-soft">[removed]</p>
  );
  return (
    <li
      className={cn(node.depth > 0 && 'border-l-[length:var(--bw)] border-line-soft pl-3 sm:pl-4')}
      data-testid="comment"
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-soft">
          <span className="font-semibold text-ink">{node.author ?? 'deleted player'}</span> ·{' '}
          {ago(node.createdAt)}
          {removed && mod ? <span className="ml-1 font-semibold text-danger">removed</span> : null}
        </p>
        {node.html && (hideBodies || node.spoiler) ? (
          <Spoiler label={hideBodies ? "Hidden until you log today's puzzle" : 'Spoiler'}>
            {body}
          </Spoiler>
        ) : (
          body
        )}
        <div className="flex flex-wrap items-center gap-1">
          <VoteButtons
            type="comment"
            id={node.id}
            score={node.score}
            myVote={node.myVote}
            disabled={removed}
            label="this comment"
          />
          {!locked && !removed ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setReplying((r) => !r)}
              aria-expanded={replying}
            >
              <MessageSquareReply aria-hidden /> Reply
            </Button>
          ) : null}
          <ContentMenu
            type="comment"
            id={node.id}
            mine={node.mine}
            mod={mod}
            status={node.status}
          />
        </div>
        {replying ? (
          <CommentForm postId={postId} parentId={node.id} onDone={() => setReplying(false)} />
        ) : null}
      </div>
      {node.replies.length ? (
        <ol className="mt-3 flex flex-col gap-3">
          {node.replies.map((r) => (
            <Comment
              key={r.id}
              node={r}
              postId={postId}
              locked={locked}
              hideBodies={hideBodies}
              mod={mod}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function CommentForm({
  postId,
  parentId,
  onDone,
}: {
  postId: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/posts/${postId}/comments`, { body, parentId: parentId ?? null, spoiler });
      setBody('');
      setSpoiler(false);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post. Try again.');
    } finally {
      setBusy(false);
    }
  }
  const label = parentId ? 'Your reply' : 'Add a comment';
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label className="sr-only" htmlFor={`c-${parentId ?? postId}`}>
        {label}
      </label>
      <Textarea
        id={`c-${parentId ?? postId}`}
        value={body}
        maxLength={MAX_COMMENT_BODY}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? 'Write a reply…' : 'Add a comment…'}
        className="min-h-20 text-sm"
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <Switch
            checked={spoiler}
            onCheckedChange={setSpoiler}
            aria-label="Mark as spoiler"
            className="scale-75"
          />
          Spoiler
        </label>
        <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
          {parentId ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}
