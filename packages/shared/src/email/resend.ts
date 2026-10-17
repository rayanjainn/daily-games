/**
 * Minimal Resend client over fetch, so the web app and the worker can both send email without
 * an SDK. https://resend.com/docs/api-reference/emails/send-email
 */
export interface EmailConfig {
  apiKey: string;
  /** "EveryDaily <hello@everydaily.raycode.tech>" — the domain must be verified in Resend. */
  from: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type EmailOutcome =
  { ok: true; id: string } | { ok: false; retry: boolean; status: number; detail: string };

export async function sendEmail(
  config: EmailConfig,
  msg: EmailMessage,
  fetcher: typeof fetch = fetch,
): Promise<EmailOutcome> {
  let res: Response;
  try {
    res = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: config.from, ...msg }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, retry: true, status: 0, detail: String(err).slice(0, 200) };
  }
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id ?? '' };
  }
  const detail = (await res.text().catch(() => '')).slice(0, 300);
  return { ok: false, retry: res.status === 429 || res.status >= 500, status: res.status, detail };
}
