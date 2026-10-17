import { MAX_COMMENT_DEPTH } from '../domain';

/**
 * "Hot" order for a community feed: score decays with age so fresh posts can rise. Same shape
 * as the classic gravity formula, with an hour of grace for brand-new posts.
 */
export function hotScore(score: number, createdAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - createdAt.getTime()) / 3_600_000);
  return (score + 1) / (hours + 2) ** 1.5;
}

/** Where a new comment sits: its depth (capped) and its materialized path. */
export function placeComment(
  id: string,
  parent: { path: string; depth: number } | null,
): { depth: number; path: string; parentPath: string | null } {
  if (!parent) return { depth: 0, path: id, parentPath: null };
  if (parent.depth + 1 >= MAX_COMMENT_DEPTH) {
    // Too deep: becomes a sibling of the parent (a reply at the last level).
    const parentPath = parent.path.split('/').slice(0, -1).join('/') || null;
    return { depth: parent.depth, path: parentPath ? `${parentPath}/${id}` : id, parentPath };
  }
  return { depth: parent.depth + 1, path: `${parent.path}/${id}`, parentPath: parent.path };
}

export interface FlatComment {
  id: string;
  path: string;
  depth: number;
}

export type CommentNode<T extends FlatComment> = T & { replies: CommentNode<T>[] };

/** Builds the reply tree from comments sorted by path (orphans become top-level). */
export function buildThread<T extends FlatComment>(flat: T[]): CommentNode<T>[] {
  const byPath = new Map<string, CommentNode<T>>();
  const roots: CommentNode<T>[] = [];
  for (const c of [...flat].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const node: CommentNode<T> = { ...c, replies: [] };
    byPath.set(c.path, node);
    const parentPath = c.path.split('/').slice(0, -1).join('/');
    const parent = parentPath ? byPath.get(parentPath) : undefined;
    (parent ? parent.replies : roots).push(node);
  }
  return roots;
}
