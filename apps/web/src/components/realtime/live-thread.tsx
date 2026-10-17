'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { CommentThread } from '@/components/community/comment-thread';
import { useRoom } from '@/lib/use-room';
import type { CommentView } from '@/server/community';
import { LiveBar } from './live-bar';

/** The comment thread, kept up to date while open: new comments appear for everyone. */
export function LiveThread(props: {
  postId: string;
  comments: CommentView[];
  locked: boolean;
  hideBodies: boolean;
  mod: boolean;
  selfName: string;
}) {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const room = useRoom(`thread:${props.postId}`, () => {
    // Several comments landing together refresh once.
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => router.refresh(), 250);
  });
  return (
    <div className="flex flex-col gap-3">
      <LiveBar state={room} selfName={props.selfName} />
      <CommentThread
        postId={props.postId}
        comments={props.comments}
        locked={props.locked}
        hideBodies={props.hideBodies}
        mod={props.mod}
        onTyping={room.sendTyping}
      />
    </div>
  );
}
