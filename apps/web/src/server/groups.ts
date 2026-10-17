import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { and, asc, count, eq, groupMembers, groups, inArray, users } from '@everydaily/shared/db';
import { MAX_GROUP_MEMBERS, MAX_GROUPS_PER_USER, type GroupRole } from '@everydaily/shared/domain';
import { playerBoard, type Board } from './boards';
import { db } from './db';
import { publishSafely } from './realtime';
import { HttpError } from './session';

export const groupNameSchema = z.string().trim().min(1, 'Give the group a name.').max(40);

/** 12 characters from an unambiguous alphabet: easy to read out, hard to guess. */
export function newInviteCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');
}

const NOT_FOUND = () => new HttpError(404, 'not_found', 'Group not found.');

export interface GroupSummary {
  id: string;
  name: string;
  role: GroupRole;
  members: number;
}

export async function myGroups(userId: string): Promise<GroupSummary[]> {
  const mine = await db()
    .select({ id: groups.id, name: groups.name, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
  if (!mine.length) return [];
  const counts = await db()
    .select({ groupId: groupMembers.groupId, n: count() })
    .from(groupMembers)
    .where(
      inArray(
        groupMembers.groupId,
        mine.map((g) => g.id),
      ),
    )
    .groupBy(groupMembers.groupId);
  const by = new Map(counts.map((c) => [c.groupId, Number(c.n)]));
  return mine.map((g) => ({ ...g, members: by.get(g.id) ?? 1 }));
}

async function groupCount(userId: string) {
  const [r] = await db()
    .select({ n: count() })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  return Number(r?.n ?? 0);
}

export async function createGroup(userId: string, name: string) {
  if ((await groupCount(userId)) >= MAX_GROUPS_PER_USER)
    throw new HttpError(422, 'too_many', `You can be in up to ${MAX_GROUPS_PER_USER} groups.`);
  return db().transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({ name, inviteCode: newInviteCode(), ownerId: userId })
      .returning({ id: groups.id });
    await tx.insert(groupMembers).values({ groupId: g!.id, userId, role: 'owner' });
    return { id: g!.id };
  });
}

/** The group and the viewer's role in it, or null if the viewer isn't a member. */
export async function membership(userId: string, groupId: string) {
  if (!z.string().uuid().safeParse(groupId).success) return null;
  const [r] = await db()
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return r ?? null;
}

export async function groupByCode(code: string) {
  if (!/^[a-z0-9]{6,24}$/.test(code)) return null;
  const [g] = await db().select().from(groups).where(eq(groups.inviteCode, code));
  if (!g) return null;
  const [m] = await db()
    .select({ n: count() })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, g.id));
  return { id: g.id, name: g.name, members: Number(m?.n ?? 0) };
}

export async function joinByCode(userId: string, code: string) {
  const g = await groupByCode(code);
  if (!g) throw new HttpError(404, 'not_found', 'That invite link is not valid any more.');
  if (await membership(userId, g.id)) return { id: g.id };
  if (g.members >= MAX_GROUP_MEMBERS)
    throw new HttpError(422, 'full', `This group is full (${MAX_GROUP_MEMBERS} players).`);
  if ((await groupCount(userId)) >= MAX_GROUPS_PER_USER)
    throw new HttpError(422, 'too_many', `You can be in up to ${MAX_GROUPS_PER_USER} groups.`);
  await db().insert(groupMembers).values({ groupId: g.id, userId }).onConflictDoNothing();
  return { id: g.id };
}

async function requireManager(userId: string, groupId: string) {
  const m = await membership(userId, groupId);
  if (!m) throw NOT_FOUND();
  if (m.role === 'member')
    throw new HttpError(403, 'forbidden', 'Only the group owner or admins can do that.');
  return m;
}

export async function renameGroup(userId: string, groupId: string, name: string) {
  await requireManager(userId, groupId);
  await db().update(groups).set({ name }).where(eq(groups.id, groupId));
}

export async function regenerateInvite(userId: string, groupId: string) {
  await requireManager(userId, groupId);
  const code = newInviteCode();
  await db().update(groups).set({ inviteCode: code }).where(eq(groups.id, groupId));
  return { inviteCode: code };
}

export async function removeMember(actorId: string, groupId: string, memberId: string) {
  const m = await requireManager(actorId, groupId);
  if (memberId === m.group.ownerId)
    throw new HttpError(403, 'forbidden', "The owner can't be removed.");
  await db()
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
}

export async function deleteGroup(userId: string, groupId: string) {
  const m = await membership(userId, groupId);
  if (!m) throw NOT_FOUND();
  if (m.role !== 'owner')
    throw new HttpError(403, 'forbidden', 'Only the owner can delete the group.');
  await db().delete(groups).where(eq(groups.id, groupId));
}

/** Leaving as the owner hands the group to the longest-standing member, or deletes it if empty. */
export async function leaveGroup(userId: string, groupId: string) {
  const m = await membership(userId, groupId);
  if (!m) throw NOT_FOUND();
  await db().transaction(async (tx) => {
    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    if (m.role !== 'owner') return;
    const [next] = await tx
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt))
      .limit(1);
    if (!next) {
      await tx.delete(groups).where(eq(groups.id, groupId));
      return;
    }
    await tx
      .update(groupMembers)
      .set({ role: 'owner' })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, next.userId)));
    await tx.update(groups).set({ ownerId: next.userId }).where(eq(groups.id, groupId));
  });
}

export interface GroupBoard extends Board {
  members: { id: string; name: string; role: GroupRole }[];
}

/** The group's boards (see `playerBoard`) plus its member list. */
export async function groupBoard(
  viewer: { id: string; timezone: string; spoilerSafe: boolean },
  groupId: string,
  slug: string | null,
  now = new Date(),
): Promise<GroupBoard> {
  const memberRows = await db()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  const members = memberRows.map((m) => ({
    id: m.id,
    name: m.displayName ?? m.username,
    role: m.role,
  }));
  return { members, ...(await playerBoard(viewer, members, slug, now)) };
}

/**
 * Tells every group the player is in that their board changed (after a result is saved or
 * removed). Best effort: a missed message only means a board refreshes on the next load.
 */
export async function announceResultChange(userId: string) {
  const rows = await db()
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  await Promise.all(
    rows.map((r) => publishSafely(`group:${r.groupId}`, 'leaderboard.updated', { userId })),
  );
}
