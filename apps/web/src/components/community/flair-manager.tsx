'use client';

import { Tag, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FLAIR_COLORS, type FlairColor } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { FlairBadge } from './flair-badge';

/** Moderators add and remove a community's flairs. */
export function FlairManager({
  slug,
  flairs,
}: {
  slug: string;
  flairs: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState<FlairColor>('grape');
  const fail = (err: unknown) =>
    toast({ tone: 'error', title: err instanceof ApiError ? err.message : 'Could not save.' });
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/admin/communities/${slug}/flairs`, { name, color });
      setName('');
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }
  return (
    <details className="rounded-md border-2 border-dashed border-line-soft p-3">
      <summary className="flex items-center gap-2 text-sm font-semibold">
        <Tag className="size-4" aria-hidden /> Flairs (moderators)
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {flairs.map((f) => (
            <li key={f.id} className="flex items-center gap-1">
              <FlairBadge flair={f} />
              <button
                type="button"
                className="rounded p-0.5 text-ink-soft hover:text-danger"
                aria-label={`Delete flair ${f.name}`}
                onClick={async () => {
                  try {
                    await api(`/api/admin/flairs/${f.id}`, {}, 'DELETE');
                    router.refresh();
                  } catch (err) {
                    fail(err);
                  }
                }}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="flair-name">
            Flair name
          </label>
          <Input
            id="flair-name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Flair name"
            className="w-40"
          />
          <label className="sr-only" htmlFor="flair-color">
            Flair colour
          </label>
          <Select
            id="flair-color"
            value={color}
            onChange={(e) => setColor(e.target.value as FlairColor)}
            className="w-36"
          >
            {FLAIR_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}>
            Add flair
          </Button>
        </form>
      </div>
    </details>
  );
}
