import type { RoomDO } from './room';

export interface Env {
  ROOMS: DurableObjectNamespace<RoomDO>;
  /** Ed25519 public key (raw, base64url) matching the web app's REALTIME_SIGNING_KEY. */
  REALTIME_PUBLIC_KEY: string;
  /** Shared secret for HMAC-signed web app → worker calls. */
  INTERNAL_BROADCAST_SECRET: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  DEV_ROUTES?: string;
}
