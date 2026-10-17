import { z } from 'zod';
import { isValidTimeZone } from '@everydaily/shared/time/zoned';

/** Loose structural check of a WebAuthn response; the library does the real verification. */
const b64url = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(4096);
export const registrationResponse = z.object({
  id: b64url,
  rawId: b64url,
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: b64url,
    attestationObject: b64url,
    transports: z.array(z.string().max(20)).max(10).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: b64url.optional(),
    authenticatorData: b64url.optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

export const authenticationResponse = z.object({
  id: b64url,
  rawId: b64url,
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: b64url,
    authenticatorData: b64url,
    signature: b64url,
    userHandle: b64url.optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

export const timezone = z.string().max(64).refine(isValidTimeZone, 'Unknown timezone').catch('UTC');
