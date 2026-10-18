'use client';

import { PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MAX_POST_BODY, MAX_POST_TITLE } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, ApiError } from '@/lib/api';

export function PostComposer({
  slug,
  communityName,
  flairs,
}: {
  slug: string;
  communityName: string;
  flairs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [flairId, setFlairId] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api<{ id: string }>(`/api/c/${slug}/posts`, {
        title,
        body,
        flairId: flairId || null,
        spoiler,
      });
      router.push(`/c/${slug}/${p.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post. Try again.');
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PenLine aria-hidden /> New post
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Post in ${communityName}`}
        description="Markdown works: **bold**, _italics_, lists, links and `code`. Hide part of a line with ||double bars||."
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Title">
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={title}
                maxLength={MAX_POST_TITLE}
                onChange={(e) => setTitle(e.target.value)}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          <Field label="Text" hint="Optional.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={body}
                maxLength={MAX_POST_BODY}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-36"
                aria-describedby={describedBy}
              />
            )}
          </Field>
          {flairs.length ? (
            <Field label="Flair">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={flairId}
                  onChange={(e) => setFlairId(e.target.value)}
                  aria-describedby={describedBy}
                >
                  <option value="">None</option>
                  {flairs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <label className="flex items-center justify-between gap-3 rounded-md border-[length:var(--bw)] border-line-soft px-4 py-3">
            <span className="text-sm font-semibold">
              Contains spoilers
              <span className="block text-xs font-normal text-ink-soft">
                The text stays hidden until a reader taps it.
              </span>
            </span>
            <Switch checked={spoiler} onCheckedChange={setSpoiler} aria-label="Contains spoilers" />
          </label>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={busy} disabled={!title.trim()} className="self-start">
            Post
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
