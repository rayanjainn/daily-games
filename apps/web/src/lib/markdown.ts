import { micromark } from 'micromark';
import { gfmStrikethrough, gfmStrikethroughHtml } from 'micromark-extension-gfm-strikethrough';
import sanitizeHtml from 'sanitize-html';

/**
 * Posts and comments are a small Markdown subset: paragraphs, emphasis, strikethrough, inline
 * and block code, quotes, lists and links. Raw HTML in the source is escaped by micromark, and
 * the output goes through an allowlist anyway. Headings render as bold paragraphs and images
 * become links, so nobody can shout or hotlink in a thread.
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
  ],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
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

export function renderMarkdown(source: string): string {
  const html = micromark(source, {
    allowDangerousHtml: false,
    extensions: [gfmStrikethrough({ singleTilde: false })],
    htmlExtensions: [gfmStrikethroughHtml()],
  });
  return sanitizeHtml(html, OPTIONS);
}

/** Plain-text excerpt for previews (Markdown syntax stripped, whitespace collapsed). */
export function excerpt(source: string, max = 180): string {
  const text = sanitizeHtml(renderMarkdown(source), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
