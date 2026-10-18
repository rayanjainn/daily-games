import { micromark } from 'micromark';
import { gfmStrikethrough, gfmStrikethroughHtml } from 'micromark-extension-gfm-strikethrough';
import sanitizeHtml from 'sanitize-html';

/**
 * Posts and comments are a small Markdown subset: paragraphs, emphasis, strikethrough, inline
 * and block code, quotes, lists and links. Raw HTML in the source is escaped by micromark, and
 * the output goes through an allowlist anyway. Headings render as bold paragraphs and images
 * become links, so nobody can shout or hotlink in a thread. `||text||` hides part of a line
 * behind a tap-to-reveal spoiler.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'span',
  ],
  // Only our own spoiler markup produces spans or these attributes: raw HTML is escaped upstream.
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
    span: ['class', 'role', 'tabindex', 'aria-label'],
  },
  allowedClasses: { span: ['spoiler'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    h1: 'p',
    h2: 'p',
    h3: 'p',
    h4: 'p',
    h5: 'p',
    h6: 'p',
    img: (_tag, attribs) => ({
      tagName: 'a',
      attribs: { href: attribs.src ?? '' },
      text: attribs.alt || attribs.src || 'image',
    }),
    a: (_tag, attribs) => ({
      tagName: 'a',
      attribs: {
        href: attribs.href ?? '',
        rel: 'nofollow ugc noopener noreferrer',
        target: '_blank',
      },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === 'a' && !frame.attribs.href,
};

// The text sits in an inner span that CSS hides (visibility) until revealed, so neither sight nor
// screen readers get it early and the button's label is all that is announced.
const SPOILER_OPEN =
  '<span class="spoiler" role="button" tabindex="0" aria-label="Spoiler, press to reveal"><span>';
const SPOILER_CLOSE = '</span></span>';
const BLOCK_TAG = /^<\/?(p|li|ul|ol|blockquote|pre|h[1-6])[\s>]/i;
const SKIP_OPEN = /^<(code|a)[\s>]/i;
const SKIP_CLOSE = /^<\/(code|a)>/i;

/**
 * Turns `||text||` into spoiler spans in rendered HTML. Pairs are matched within one block (a
 * paragraph or list item), outside code and links; a lone `||` stays as typed.
 */
function applyInlineSpoilers(html: string): string {
  const parts = html.split(/(<[^>]+>)/);
  let skip = 0;
  // Text parts (by index) with at least one marker, for the block being read.
  let pending: number[] = [];
  const flush = () => {
    const markers: { part: number; at: number }[] = [];
    for (const part of pending)
      for (const m of parts[part]!.matchAll(/\|\|/g)) markers.push({ part, at: m.index });
    pending = [];
    // An odd one out is left literal; the rest pair up in order.
    const paired = markers.length - (markers.length % 2);
    // Replace from the end so earlier offsets stay valid.
    for (let i = paired - 1; i >= 0; i--) {
      const { part, at } = markers[i]!;
      const text = parts[part]!;
      parts[part] =
        `${text.slice(0, at)}${i % 2 === 0 ? SPOILER_OPEN : SPOILER_CLOSE}${text.slice(at + 2)}`;
    }
  };
  parts.forEach((token, i) => {
    if (token.startsWith('<')) {
      if (BLOCK_TAG.test(token)) flush();
      else if (SKIP_OPEN.test(token)) skip++;
      else if (SKIP_CLOSE.test(token)) skip = Math.max(0, skip - 1);
    } else if (!skip && token.includes('||')) pending.push(i);
  });
  flush();
  return parts.join('');
}

export function renderMarkdown(source: string): string {
  const html = micromark(source, {
    allowDangerousHtml: false,
    extensions: [gfmStrikethrough({ singleTilde: false })],
    htmlExtensions: [gfmStrikethroughHtml()],
  });
  return sanitizeHtml(applyInlineSpoilers(html), OPTIONS);
}

/** Plain-text excerpt for previews (Markdown syntax stripped, whitespace collapsed). */
export function excerpt(source: string, max = 180): string {
  // Spoilers never show in previews.
  const hidden = source.replace(/\|\|[^\n]*?\|\|/g, '[spoiler]');
  const text = sanitizeHtml(renderMarkdown(hidden), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
