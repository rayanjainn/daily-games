/**
 * Wire protocol between browser and RoomDO. JSON text frames, one message per frame.
 * See PLAN.md section 10.
 */
import { z } from 'zod';

export const REALTIME_SUBPROTOCOL = 'ed.v1';
export const AUTH_PROTOCOL_PREFIX = 'auth.';

/** Close codes (4000-4999 are application-defined). */
export const CloseCode = {
  ReauthRequired: 4401,
  Forbidden: 4403,
  BadMessage: 4400,
  RateLimited: 4429,
} as const;

export const RING_BUFFER_SIZE = 200;
/** A socket must present a fresh token within this window or it is closed with 4401. */
export const REAUTH_INTERVAL_SECONDS = 10 * 60;

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('typing') }),
  z.object({ t: z.literal('resume'), since: z.number().int().min(0) }),
  z.object({ t: z.literal('reauth'), token: z.string().min(1).max(2048) }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type PresenceUser = { userId: string; name: string };

export type ServerMessage =
  | { t: 'hello'; seq: number; presence: PresenceUser[] }
  | { t: 'event'; seq: number; kind: string; data: unknown }
  | { t: 'presence'; joined?: PresenceUser; left?: PresenceUser }
  | { t: 'typing'; userId: string; name: string; until: number }
  | { t: 'resync' }
  | { t: 'reauthed'; until: number }
  | { t: 'error'; code: string };

/** Body of POST /internal/broadcast (web app → worker). */
export const broadcastSchema = z.object({
  room: z.string(),
  kind: z.string().min(1).max(64),
  data: z.unknown(),
});
export type Broadcast = z.infer<typeof broadcastSchema>;
