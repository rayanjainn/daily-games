import 'server-only';
import { z } from 'zod';
import { and, eq, gameNotes } from '@everydaily/shared/db';
import { MAX_NOTE_LENGTH } from '@everydaily/shared/domain';
import { db } from './db';

export const noteInputSchema = z
  .object({
    body: z.string().max(MAX_NOTE_LENGTH, `Notes are limited to ${MAX_NOTE_LENGTH} characters.`),
  })
  .strict();

export async function getNote(userId: string, gameId: string) {
  const rows = await db()
    .select({ body: gameNotes.body, updatedAt: gameNotes.updatedAt })
    .from(gameNotes)
    .where(and(eq(gameNotes.userId, userId), eq(gameNotes.gameId, gameId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Saves the player's note for a game; an empty note is deleted rather than stored. */
export async function saveNote(userId: string, gameId: string, body: string) {
  const text = body.replace(/\r\n?/g, '\n');
  if (!text.trim()) {
    await db()
      .delete(gameNotes)
      .where(and(eq(gameNotes.userId, userId), eq(gameNotes.gameId, gameId)));
    return { body: '', updatedAt: null };
  }
  const [row] = await db()
    .insert(gameNotes)
    .values({ userId, gameId, body: text })
    .onConflictDoUpdate({
      target: [gameNotes.userId, gameNotes.gameId],
      set: { body: text, updatedAt: new Date() },
    })
    .returning({ body: gameNotes.body, updatedAt: gameNotes.updatedAt });
  return { body: row!.body, updatedAt: row!.updatedAt.toISOString() };
}
