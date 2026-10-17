import { createDb, type Database } from '@everydaily/shared/db';
import type { Env } from './env';
import { buildPushRequest, sendPush, vapidFromEnv, type PushSubscription } from './push';
import { HEALTH_CRON, runDailyHealth } from './health';
import {
  dbSubscriptionStore,
  deliverToUser,
  handleReminderBatch,
  REMINDER_CRON,
  runReminderCron,
  type ReminderMessage,
} from './reminders';
import { handleBroadcast, handleConnect, handlePushTest } from './realtime-routes';

export { RoomDO } from './room';

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'worker' });
    }

    if (url.pathname.startsWith('/rt/') && request.method === 'GET') {
      return handleConnect(request, env, url.pathname);
    }

    if (url.pathname === '/internal/broadcast' && request.method === 'POST') {
      return handleBroadcast(request, env);
    }

    if (url.pathname === '/internal/push-test' && request.method === 'POST') {
      return handlePushTest(request, env, (userId) =>
        withDb(env, (db) =>
          deliverToUser(dbSubscriptionStore(db), vapidFromEnv(env), userId, {
            title: 'Reminders are on',
            body: "This is how EveryDaily will nudge you. You're all set.",
            url: '/settings',
            tag: 'test',
          }),
        ),
      );
    }

    if (env.DEV_ROUTES === '1' && request.method === 'POST') {
      const { subscription, title, body } = (await request.json()) as {
        subscription: PushSubscription;
        title: string;
        body: string;
      };
      if (url.pathname === '/dev/push') {
        return Response.json(await sendPush(subscription, { title, body }, vapidFromEnv(env)));
      }
      // Returns the encrypted request instead of sending it, for environments where the
      // local runtime has no direct outbound network.
      if (url.pathname === '/dev/push-request') {
        const req = await buildPushRequest(subscription, { title, body }, vapidFromEnv(env));
        const bytes = new Uint8Array(await new Response(req.body).arrayBuffer());
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return Response.json({ headers: req.headers, body: btoa(bin) });
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(controller, env, ctx): Promise<void> {
    if (controller.cron === HEALTH_CRON) ctx.waitUntil(runDailyHealth(env));
    if (controller.cron === REMINDER_CRON)
      ctx.waitUntil(runReminderCron(env, new Date(controller.scheduledTime)));
  },

  async queue(batch, env): Promise<void> {
    await handleReminderBatch(batch, env);
  },
} satisfies ExportedHandler<Env, ReminderMessage>;

async function withDb<T>(env: Env, fn: (db: Database) => Promise<T>): Promise<T> {
  const { db, client } = createDb(env.HYPERDRIVE.connectionString, { max: 1 });
  try {
    return await fn(db);
  } finally {
    await client.end();
  }
}
