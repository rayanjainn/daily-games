import { BRAND } from '../brand';
import type { Notification } from '../reminders/plan';
import type { EmailMessage } from './resend';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function layout(
  heading: string,
  body: string,
  cta: { label: string; url: string },
  footer: string,
) {
  return `<!doctype html><html><body style="margin:0;background:#fff8ec;font-family:system-ui,sans-serif;color:#1d1b33">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;font-size:18px;margin:0 0 24px">${esc(BRAND.name)}</p>
<h1 style="font-size:22px;margin:0 0 12px">${esc(heading)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${esc(body)}</p>
<a href="${esc(cta.url)}" style="display:inline-block;background:#ff5a1f;color:#1d1b33;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:12px;border:2px solid #1d1b33">${esc(cta.label)}</a>
<p style="font-size:13px;color:#5b5873;margin:32px 0 0">${esc(footer)}</p>
</div></body></html>`;
}

export function verifyEmail(to: string, link: string): EmailMessage {
  const subject = `Confirm your email for ${BRAND.name}`;
  const body = 'Tap the button to confirm this address. The link works for 24 hours.';
  const footer = "If you didn't ask for this, ignore this email and nothing will change.";
  return {
    to,
    subject,
    text: `${body}\n\n${link}\n\n${footer}`,
    html: layout('Confirm your email', body, { label: 'Confirm email', url: link }, footer),
  };
}

export function loginEmail(to: string, link: string): EmailMessage {
  const subject = `Your ${BRAND.name} sign-in link`;
  const body = 'Tap the button to sign in. The link works once and expires in 15 minutes.';
  const footer = "If you didn't ask to sign in, ignore this email. Nobody can sign in without it.";
  return {
    to,
    subject,
    text: `${body}\n\n${link}\n\n${footer}`,
    html: layout('Sign in', body, { label: 'Sign in', url: link }, footer),
  };
}

export function reminderEmail(to: string, n: Notification, appUrl: string): EmailMessage {
  const url = new URL(n.url, appUrl).toString();
  const settings = new URL('/settings', appUrl).toString();
  const footer = `You get these because email reminders are on. Turn them off in Settings: ${settings}`;
  return {
    to,
    subject: n.title,
    text: `${n.body}\n\n${url}\n\n${footer}`,
    html: layout(n.title, n.body, { label: `Open ${BRAND.name}`, url }, footer),
  };
}
