import 'server-only';
import { sql } from '@everydaily/shared/db';
import { db } from './db';

/**
 * Whole-platform numbers for the admin. Everything is counted in the database in a handful of
 * queries; nothing here is personal (no names, no emails), only totals and per-game counts.
 */
export interface PlatformStats {
  generatedAt: string;
  people: {
    total: number;
    onlineNow: number;
    active24h: number;
    active7d: number;
    active30d: number;
    new24h: number;
    new7d: number;
    new30d: number;
    withEmail: number;
    withPush: number;
    withExtension: number;
    mods: number;
  };
  play: {
    results: number;
    results24h: number;
    results7d: number;
    solveRate7d: number | null;
    follows: number;
    avgFollows: number;
    nativePlays: number;
    bySource: { source: string; count: number }[];
    games: number;
  };
  social: {
    friendships: number;
    groups: number;
    groupMembers: number;
    posts: number;
    comments: number;
    votes: number;
    posts7d: number;
    comments7d: number;
    posters7d: number;
    openReports: number;
    removed: number;
  };
  perGame: {
    slug: string;
    name: string;
    followers: number;
    players7d: number;
    results7d: number;
    resultsTotal: number;
    solveRate7d: number | null;
  }[];
  boards: { slug: string; name: string; posts7d: number; comments7d: number; people7d: number }[];
  daily: {
    day: string;
    newPeople: number;
    activePeople: number;
    results: number;
    posts: number;
    comments: number;
  }[];
}

const n = (v: unknown) => Number(v ?? 0);
const rate = (solved: unknown, total: unknown) => (n(total) ? n(solved) / n(total) : null);

type Row = Record<string, unknown>;
async function rows(q: ReturnType<typeof sql>): Promise<Row[]> {
  return (await db().execute(q)) as unknown as Row[];
}

export async function platformStats(now = new Date()): Promise<PlatformStats> {
  const [people] = await rows(sql`
    SELECT
      (SELECT count(*) FROM users WHERE deleted_at IS NULL) AS total,
      (SELECT count(DISTINCT user_id) FROM sessions
         WHERE revoked_at IS NULL AND last_seen_at > now() - interval '10 minutes') AS online,
      (SELECT count(DISTINCT user_id) FROM sessions WHERE last_seen_at > now() - interval '1 day') AS a1,
      (SELECT count(DISTINCT user_id) FROM sessions WHERE last_seen_at > now() - interval '7 days') AS a7,
      (SELECT count(DISTINCT user_id) FROM sessions WHERE last_seen_at > now() - interval '30 days') AS a30,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '1 day') AS n1,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '7 days') AS n7,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS n30,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND email_verified_at IS NOT NULL) AS email,
      (SELECT count(DISTINCT user_id) FROM push_subscriptions) AS push,
      (SELECT count(DISTINCT user_id) FROM capture_tokens WHERE revoked_at IS NULL) AS ext,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND role IN ('mod','admin')) AS mods`);

  const [play] = await rows(sql`
    SELECT
      (SELECT count(*) FROM results) AS results,
      (SELECT count(*) FROM results WHERE created_at > now() - interval '1 day') AS r1,
      (SELECT count(*) FROM results WHERE created_at > now() - interval '7 days') AS r7,
      (SELECT count(*) FROM results WHERE created_at > now() - interval '7 days' AND solved) AS s7,
      (SELECT count(*) FROM follows) AS follows,
      (SELECT count(*) FROM native_plays) AS native,
      (SELECT count(*) FROM games WHERE status <> 'archived') AS games`);
  const bySource = await rows(sql`
    SELECT source, count(*) AS c FROM results GROUP BY source ORDER BY c DESC`);

  const [social] = await rows(sql`
    SELECT
      (SELECT count(*) FROM friendships WHERE status = 'accepted') AS friends,
      (SELECT count(*) FROM groups) AS groups,
      (SELECT count(*) FROM group_members) AS members,
      (SELECT count(*) FROM posts) AS posts,
      (SELECT count(*) FROM comments) AS comments,
      (SELECT count(*) FROM votes) AS votes,
      (SELECT count(*) FROM posts WHERE created_at > now() - interval '7 days') AS p7,
      (SELECT count(*) FROM comments WHERE created_at > now() - interval '7 days') AS c7,
      (SELECT count(*) FROM (
         SELECT author_id FROM posts WHERE created_at > now() - interval '7 days' AND author_id IS NOT NULL
         UNION SELECT author_id FROM comments WHERE created_at > now() - interval '7 days' AND author_id IS NOT NULL
       ) x) AS posters,
      (SELECT count(*) FROM content_reports WHERE status = 'open') AS open_reports,
      (SELECT (SELECT count(*) FROM posts WHERE status = 'removed')
            + (SELECT count(*) FROM comments WHERE status = 'removed')) AS removed`);

  const perGame = await rows(sql`
    SELECT g.slug, g.name,
      (SELECT count(*) FROM follows f WHERE f.game_id = g.id) AS followers,
      (SELECT count(DISTINCT r.user_id) FROM results r
         WHERE r.game_id = g.id AND r.created_at > now() - interval '7 days') AS players7,
      (SELECT count(*) FROM results r
         WHERE r.game_id = g.id AND r.created_at > now() - interval '7 days') AS results7,
      (SELECT count(*) FROM results r
         WHERE r.game_id = g.id AND r.created_at > now() - interval '7 days' AND r.solved) AS solved7,
      (SELECT count(*) FROM results r WHERE r.game_id = g.id) AS total
    FROM games g WHERE g.status <> 'archived'
    ORDER BY players7 DESC, followers DESC, g.name`);

  const boards = await rows(sql`
    SELECT c.slug, c.name,
      (SELECT count(*) FROM posts p WHERE p.community_id = c.id
         AND p.created_at > now() - interval '7 days') AS posts7,
      (SELECT count(*) FROM comments m JOIN posts p ON p.id = m.post_id
         WHERE p.community_id = c.id AND m.created_at > now() - interval '7 days') AS comments7,
      (SELECT count(*) FROM (
         SELECT p.author_id FROM posts p WHERE p.community_id = c.id
           AND p.created_at > now() - interval '7 days' AND p.author_id IS NOT NULL
         UNION SELECT m.author_id FROM comments m JOIN posts p ON p.id = m.post_id
           WHERE p.community_id = c.id AND m.created_at > now() - interval '7 days'
           AND m.author_id IS NOT NULL) y) AS people7
    FROM communities c
    ORDER BY (SELECT count(*) FROM comments m JOIN posts p ON p.id = m.post_id
              WHERE p.community_id = c.id AND m.created_at > now() - interval '7 days') DESC, c.name
    LIMIT 15`);

  const daily = await rows(sql`
    SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM users u WHERE u.deleted_at IS NULL AND u.created_at::date = d) AS new_people,
      (SELECT count(DISTINCT s.user_id) FROM sessions s WHERE s.last_seen_at::date = d) AS active,
      (SELECT count(*) FROM results r WHERE r.created_at::date = d) AS results,
      (SELECT count(*) FROM posts p WHERE p.created_at::date = d) AS posts,
      (SELECT count(*) FROM comments m WHERE m.created_at::date = d) AS comments
    FROM generate_series((now() AT TIME ZONE 'UTC')::date - 13, (now() AT TIME ZONE 'UTC')::date, '1 day') AS d
    ORDER BY d DESC`);

  const p = people!;
  const total = n(p.total);
  return {
    generatedAt: now.toISOString(),
    people: {
      total,
      onlineNow: n(p.online),
      active24h: n(p.a1),
      active7d: n(p.a7),
      active30d: n(p.a30),
      new24h: n(p.n1),
      new7d: n(p.n7),
      new30d: n(p.n30),
      withEmail: n(p.email),
      withPush: n(p.push),
      withExtension: n(p.ext),
      mods: n(p.mods),
    },
    play: {
      results: n(play!.results),
      results24h: n(play!.r1),
      results7d: n(play!.r7),
      solveRate7d: rate(play!.s7, play!.r7),
      follows: n(play!.follows),
      avgFollows: total ? Math.round((n(play!.follows) / total) * 10) / 10 : 0,
      nativePlays: n(play!.native),
      bySource: bySource.map((r) => ({ source: String(r.source), count: n(r.c) })),
      games: n(play!.games),
    },
    social: {
      friendships: n(social!.friends),
      groups: n(social!.groups),
      groupMembers: n(social!.members),
      posts: n(social!.posts),
      comments: n(social!.comments),
      votes: n(social!.votes),
      posts7d: n(social!.p7),
      comments7d: n(social!.c7),
      posters7d: n(social!.posters),
      openReports: n(social!.open_reports),
      removed: n(social!.removed),
    },
    perGame: perGame.map((r) => ({
      slug: String(r.slug),
      name: String(r.name),
      followers: n(r.followers),
      players7d: n(r.players7),
      results7d: n(r.results7),
      resultsTotal: n(r.total),
      solveRate7d: rate(r.solved7, r.results7),
    })),
    boards: boards.map((r) => ({
      slug: String(r.slug),
      name: String(r.name),
      posts7d: n(r.posts7),
      comments7d: n(r.comments7),
      people7d: n(r.people7),
    })),
    daily: daily.map((r) => ({
      day: String(r.day),
      newPeople: n(r.new_people),
      activePeople: n(r.active),
      results: n(r.results),
      posts: n(r.posts),
      comments: n(r.comments),
    })),
  };
}
