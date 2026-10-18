'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/input';

/** Jump to any month the recap covers (this month back two years). */
export function MonthPicker({
  months,
  current,
}: {
  months: { value: string; label: string }[];
  current: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="recap-month" className="font-display text-sm font-semibold">
        Other month
      </label>
      <Select
        id="recap-month"
        value={current ?? ''}
        onChange={(e) => e.target.value && router.push(`/recap?month=${e.target.value}`)}
        className="w-48"
      >
        <option value="">Choose…</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
