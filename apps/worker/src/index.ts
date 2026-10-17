import type { Env } from './env';
import { buildPushRequest, sendPush, vapidFromEnv, type PushSubscription } from './push';
import { handleBroadcast, handleConnect } from './realtime-routes';

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
} satisfies ExportedHandler<Env>;
