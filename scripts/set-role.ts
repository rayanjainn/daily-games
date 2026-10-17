/**
 * Grants or removes moderator rights. Roles are only ever changed from the command line, so
 * there is no web endpoint that can escalate privileges.
 * Usage: DATABASE_URL=... pnpm user:role <username> <user|mod|admin>
 */
import { createDb, eq, users } from '@everydaily/shared/db';
import { USER_ROLES, type UserRole } from '@everydaily/shared/domain';

const [username, role] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url || !username || !USER_ROLES.includes(role as UserRole)) {
  console.error('Usage: DATABASE_URL=... pnpm user:role <username> <user|mod|admin>');
  process.exit(1);
}

const { db, client } = createDb(url, { max: 1 });
try {
  const rows = await db
    .update(users)
    .set({ role: role as UserRole, updatedAt: new Date() })
    .where(eq(users.username, username.toLowerCase()))
    .returning({ id: users.id });
  if (!rows.length) {
    console.error(`No user called "${username}".`);
    process.exitCode = 1;
  } else {
    console.log(`${username} is now ${role}.`);
  }
} finally {
  await client.end();
}
