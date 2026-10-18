'use client';

import { useState } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';

/**
 * Tries a share text on the game's saved parser without logging anything, so a moderator can
 * check a sample before (or after) a parser change. Games added here have no sample file in the
 * repo; this is how their parser gets exercised.
 */
export function ShareCheck({ slug }: { slug: string }) {
  const [text, setText] = useState('');
  const [out, setOut] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      const r = await api<{ summary: string; solved: boolean; puzzleDate: string }>(
        '/api/results/preview',
        { source: 'paste', slug, shareText: text },
      );
      setOut({
        ok: true,
        message: `Reads as ${r.solved ? 'solved' : 'not solved'}: ${r.summary} for ${r.puzzleDate}.`,
      });
    } catch (err) {
      setOut({
        ok: false,
        message: err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t-2 border-line-soft pt-4" data-testid="share-check">
      <Field
        label="Try a share text"
        hint="Checks the saved parser only; nothing is logged. Save changes first to test them."
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            value={text}
            rows={4}
            maxLength={4000}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={!text.trim()}
          onClick={check}
        >
          Check
        </Button>
      </div>
      {out ? (
        <Notice tone={out.ok ? 'info' : 'danger'}>
          <span data-testid="share-check-result">{out.message}</span>
        </Notice>
      ) : null}
    </div>
  );
}
