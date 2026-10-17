'use client';

import { BellOff, BellRing, Send } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

export interface ReminderSettingsProps {
  vapidKey: string | null;
  devices: number;
  streakNudgeAt: string | null;
  quietHours: { start: string; end: string } | null;
  games: { gameId: string; name: string; remindAt: string | null }[];
}

type DeviceState = 'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'this device';
  return `${browser} on ${os}`;
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration('/')) ??
    (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
  );
}

/**
 * Reminders: turn notifications on for this device, a "streak at risk" nudge, quiet hours, and
 * a reminder time per followed game. Every change saves straight away.
 */
export function ReminderSettings(props: ReminderSettingsProps) {
  const toast = useToast();
  const [device, setDevice] = useState<DeviceState>('checking');
  const [devices, setDevices] = useState(props.devices);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setDevice(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') return setDevice('blocked');
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      setDevice(sub ? 'on' : 'off');
    })().catch(() => setDevice('unsupported'));
  }, []);

  async function enable() {
    if (!props.vapidKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setDevice(permission === 'denied' ? 'blocked' : 'off');
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(props.vapidKey),
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api('/api/push/subscriptions', {
        endpoint: json.endpoint,
        keys: json.keys,
        label: deviceLabel(),
      });
      setDevice('on');
      setDevices((n) => n + 1);
      toast({ tone: 'success', title: 'Notifications are on for this device' });
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api('/api/push/subscriptions', { endpoint: sub.endpoint }, 'DELETE');
        await sub.unsubscribe();
      }
      setDevice('off');
      setDevices((n) => Math.max(0, n - 1));
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await api<{ sent: number }>('/api/push/test', {});
      toast({
        tone: r.sent ? 'success' : 'info',
        title: r.sent
          ? `Sent to ${r.sent} ${r.sent === 1 ? 'device' : 'devices'}`
          : 'No device accepted it. Turn notifications off and on again.',
      });
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reminders-heading">
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 id="reminders-heading" className="text-xl">
            Reminders
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            A nudge when a puzzle is still waiting or a streak is about to end. Times are in your
            timezone.
          </p>
        </div>

        {!props.vapidKey ? (
          <Notice tone="warn">Notifications aren&apos;t set up on this server yet.</Notice>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border-2 border-line-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {device === 'on' ? (
                  <BellRing className="size-5 text-success" aria-hidden />
                ) : (
                  <BellOff className="size-5 text-ink-soft" aria-hidden />
                )}
                <p className="font-display font-semibold" data-testid="push-state">
                  {device === 'on'
                    ? 'On for this device'
                    : device === 'checking'
                      ? 'Checking this device…'
                      : 'Off for this device'}
                </p>
              </div>
              {device === 'on' ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={test} disabled={busy}>
                    <Send aria-hidden />
                    Send a test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
                    Turn off
                  </Button>
                </div>
              ) : device === 'off' ? (
                <Button size="sm" onClick={enable} loading={busy}>
                  <BellRing aria-hidden />
                  Turn on notifications
                </Button>
              ) : null}
            </div>
            {device === 'blocked' ? (
              <p className="text-sm text-warn">
                Notifications are blocked for this site. Allow them in your browser&apos;s site
                settings, then come back.
              </p>
            ) : device === 'needs-install' ? (
              <p className="text-sm text-ink-soft">
                On iPhone and iPad, add EveryDaily to your Home Screen first (see Install above),
                then open it from there to turn on notifications.
              </p>
            ) : device === 'unsupported' ? (
              <p className="text-sm text-ink-soft">This browser can&apos;t show notifications.</p>
            ) : null}
            <p className="text-xs text-ink-soft" data-testid="push-devices">
              {devices === 0
                ? 'No devices get reminders yet.'
                : `${devices} ${devices === 1 ? 'device gets' : 'devices get'} reminders.`}
            </p>
          </div>
        )}

        <StreakNudge initial={props.streakNudgeAt} />
        <QuietHours initial={props.quietHours} />
        <GameTimes games={props.games} />
      </Card>
    </section>
  );
}

function useSaver() {
  const toast = useToast();
  return async (path: string, body: unknown) => {
    try {
      await api(path, body, 'PATCH');
      return true;
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
      return false;
    }
  };
}

function StreakNudge({ initial }: { initial: string | null }) {
  const save = useSaver();
  const [on, setOn] = useState(initial !== null);
  const [at, setAt] = useState(initial ?? '20:00');
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-switch`} className="font-display text-sm font-semibold">
          Streak at risk
          <span className="block font-body text-xs font-normal text-ink-soft">
            Once a day, if a streak will end unless you play.
          </span>
        </label>
        <Switch
          id={`${id}-switch`}
          checked={on}
          onCheckedChange={async (v) => {
            if (await save('/api/me/reminders', { streakNudgeAt: v ? at : null })) setOn(v);
          }}
        />
      </div>
      {on ? (
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-time`} className="text-sm">
            Remind me at
          </label>
          <Input
            id={`${id}-time`}
            type="time"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            onBlur={() => at && save('/api/me/reminders', { streakNudgeAt: at })}
            className="w-36"
          />
        </div>
      ) : null}
    </div>
  );
}

function QuietHours({ initial }: { initial: { start: string; end: string } | null }) {
  const save = useSaver();
  const [on, setOn] = useState(initial !== null);
  const [start, setStart] = useState(initial?.start ?? '22:00');
  const [end, setEnd] = useState(initial?.end ?? '08:00');
  const id = useId();
  const persist = () => start && end && save('/api/me/reminders', { quietHours: { start, end } });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-switch`} className="font-display text-sm font-semibold">
          Quiet hours
          <span className="block font-body text-xs font-normal text-ink-soft">
            No reminders during these hours.
          </span>
        </label>
        <Switch
          id={`${id}-switch`}
          checked={on}
          onCheckedChange={async (v) => {
            if (await save('/api/me/reminders', { quietHours: v ? { start, end } : null }))
              setOn(v);
          }}
        />
      </div>
      {on ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${id}-start`}>From</label>
          <Input
            id={`${id}-start`}
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={persist}
            className="w-36"
          />
          <label htmlFor={`${id}-end`}>to</label>
          <Input
            id={`${id}-end`}
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={persist}
            className="w-36"
          />
        </div>
      ) : null}
    </div>
  );
}

function GameTimes({ games }: { games: ReminderSettingsProps['games'] }) {
  if (!games.length)
    return (
      <p className="text-sm text-ink-soft">Follow some games to set a reminder for each one.</p>
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-display text-sm font-semibold">
        Per game
        <span className="block font-body text-xs font-normal text-ink-soft">
          A reminder at this time if you haven&apos;t logged today&apos;s puzzle. Leave empty for
          none.
        </span>
      </legend>
      <ul className="mt-2 divide-y-2 divide-line-soft" data-testid="game-reminders">
        {games.map((g) => (
          <GameTime key={g.gameId} game={g} />
        ))}
      </ul>
    </fieldset>
  );
}

function GameTime({ game }: { game: ReminderSettingsProps['games'][number] }) {
  const save = useSaver();
  const [at, setAt] = useState(game.remindAt ?? '');
  const [saved, setSaved] = useState(game.remindAt ?? '');
  const id = useId();
  async function persist(value: string) {
    if (value === saved) return;
    if (await save(`/api/follows/${game.gameId}/reminder`, { remindAt: value || null }))
      setSaved(value);
  }
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {game.name}
      </label>
      <span className="flex items-center gap-2">
        <Input
          id={id}
          type="time"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          onBlur={() => persist(at)}
          className="w-36"
          aria-label={`Reminder time for ${game.name}`}
        />
        {at ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAt('');
              void persist('');
            }}
            aria-label={`Clear reminder for ${game.name}`}
          >
            Clear
          </Button>
        ) : null}
      </span>
    </li>
  );
}
