'use client';

import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

export interface CaptureTokenRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'never';
const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

/** Settings: tokens that let the browser extension send results for games we can't embed. */
export function ExtensionSection({
  tokens,
  appUrl,
}: {
  tokens: CaptureTokenRow[];
  appUrl: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const out = await api<{ token: string }>('/api/me/capture-tokens', {
        label: label.trim() || 'My browser',
      });
      setFresh(out.token);
      setLabel('');
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: "Couldn't make a token", body: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="extension">
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="extension" className="text-xl">
            Browser extension
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            For games we can’t show here, the extension notices the result a game copies when you
            press its share button and saves it for you. It can only add results, and you can remove
            its access here at any time.
          </p>
        </div>

        {fresh ? (
          <Notice tone="info">
            <span className="flex flex-col gap-2">
              <span>
                Copy this token into the extension’s options page now. It is shown only once.
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <code
                  data-testid="capture-token"
                  className="break-all rounded-md bg-surface-2 px-2 py-1 text-sm"
                >
                  {fresh}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(fresh);
                      setCopied(true);
                    } catch {
                      toast({
                        tone: 'error',
                        title: "Couldn't copy",
                        body: 'Select it and copy by hand.',
                      });
                    }
                  }}
                >
                  {copied ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </span>
              <span className="text-sm">
                App address for the extension: <code>{appUrl}</code>
              </span>
            </span>
          </Notice>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Field label="Name for this browser" className="min-w-52 flex-1">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={label}
                maxLength={40}
                placeholder="Work laptop"
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={busy}>
            <Plus className="size-4" aria-hidden /> Make a token
          </Button>
        </form>

        {tokens.length ? (
          <ul className="flex flex-col gap-2.5" aria-label="Extension tokens">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-line-soft bg-surface-2/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{t.label}</p>
                  <p className="text-sm text-ink-soft">
                    Made {fmt(t.createdAt)} · last used {fmt(t.lastUsedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove token ${t.label}`}
                  onClick={async () => {
                    try {
                      await api(`/api/me/capture-tokens/${t.id}`, {}, 'DELETE');
                      router.refresh();
                    } catch (err) {
                      toast({ tone: 'error', title: "Couldn't remove it", body: errorText(err) });
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No tokens yet.</p>
        )}
      </Card>
    </section>
  );
}
