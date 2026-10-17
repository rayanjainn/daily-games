import 'server-only';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

/**
 * Addresses we must never connect to on behalf of a user: loopback, private, link-local
 * (incl. cloud metadata), CGNAT, multicast, reserved, and their IPv6 counterparts.
 */
export function isBlockedAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isBlockedAddress(mapped[1]!);
    return (
      v === '::' ||
      v === '::1' ||
      v.startsWith('fc') ||
      v.startsWith('fd') ||
      /^fe[89ab]/.test(v) ||
      v.startsWith('ff') ||
      v.startsWith('64:ff9b:') ||
      v.startsWith('2001:db8')
    );
  }
  return true;
}

/**
 * DNS lookup that refuses blocked addresses. It runs at connect time, so the address we check is
 * the address we connect to (no DNS-rebinding window between check and use).
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) {
      return callback(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }), '', 0);
    }
    if ((options as { all?: boolean }).all) return callback(null, list as never);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export interface FetchedPage {
  finalUrl: string;
  status: number;
  headers: { xFrameOptions: string | null; csp: string | null };
  title: string | null;
  description: string | null;
}

function once(url: URL, signal: AbortSignal) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      if (url.protocol !== 'https:' && url.protocol !== 'http:')
        return reject(new Error('unsupported scheme'));
      if (url.port && url.port !== '80' && url.port !== '443')
        return reject(new Error('unsupported port'));
      if (url.username || url.password) return reject(new Error('credentials in URL'));
      // Literal IPs skip DNS, so check them here.
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(host) && isBlockedAddress(host)) return reject(new Error('blocked address'));
      const mod = url.protocol === 'https:' ? https : http;
      const req = mod.request(
        url,
        {
          method: 'GET',
          lookup: guardedLookup,
          signal,
          headers: {
            'user-agent': 'EveryDailyBot/1.0 (+https://everydaily.raycode.tech)',
            accept: 'text/html,application/xhtml+xml',
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (c: Buffer) => {
            size += c.length;
            if (size > MAX_BYTES) {
              res.destroy();
              return;
            }
            chunks.push(c);
          });
          const done = () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          res.on('end', done);
          res.on('close', done);
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();
    },
  );
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function extractMeta(html: string): { title: string | null; description: string | null } {
  const title = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)?.[1];
  const desc =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']{1,500})["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']{1,500})["'][^>]*name=["']description["']/i.exec(html)?.[1];
  return {
    title: title ? decode(title).slice(0, 200) : null,
    description: desc ? decode(desc).slice(0, 300) : null,
  };
}

const header = (h: http.IncomingHttpHeaders, name: string) => {
  const v = h[name];
  return Array.isArray(v) ? v.join(', ') : (v ?? null);
};

/**
 * Fetches only a page's title, meta description and framing headers, with an SSRF guard,
 * a 5 s timeout, a 256 KB cap and at most 3 redirects (each re-checked).
 */
export async function fetchPageMeta(input: string): Promise<FetchedPage> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await once(url, signal);
    const location = header(res.headers, 'location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return {
      finalUrl: url.toString(),
      status: res.status,
      headers: {
        xFrameOptions: header(res.headers, 'x-frame-options'),
        csp: header(res.headers, 'content-security-policy'),
      },
      ...extractMeta(res.body),
    };
  }
  throw new Error('too many redirects');
}
