import { enforceLimit, mutation } from '@/server/http';
import { reminderPrefsSchema, saveReminderPrefs } from '@/server/reminders';
import { requireSession } from '@/server/session';

/** Streak nudge time and quiet hours. */
export const PATCH = mutation(reminderPrefsSchema, async (p) => {
  const { user } = await requireSession();
  await enforceLimit('reminder-edit', user.id);
  await saveReminderPrefs(user, p);
  return { ok: true };
});
