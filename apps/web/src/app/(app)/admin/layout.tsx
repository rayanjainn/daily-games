import type { ReactNode } from 'react';
import { requireRolePage } from '@/server/roles';
import { AdminNav } from './admin-nav';

/** Moderators and admins only; everyone else gets a plain 404. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRolePage('mod');
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Moderation
        </p>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
