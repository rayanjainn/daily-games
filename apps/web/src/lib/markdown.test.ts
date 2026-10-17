import { describe, expect, it } from 'vitest';
import { excerpt, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders the supported subset', () => {
    expect(renderMarkdown('**bold** _it_ ~~gone~~ `code`')).toBe(
      '<p><strong>bold</strong> <em>it</em> <del>gone</del> <code>code</code></p>',
    );
    expect(renderMarkdown('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    expect(renderMarkdown('> quote')).toContain('<blockquote>');
  });

  it('escapes raw HTML and drops scripts and event handlers', () => {
    const out = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)> hi');
    // Raw HTML is shown as text, never as tags.
    expect(out).not.toMatch(/<script|<img/i);
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('only keeps http(s) and mailto links, opened safely', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript');
    const link = renderMarkdown('[site](https://example.org)');
    expect(link).toContain('href="https://example.org"');
    expect(link).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(link).toContain('target="_blank"');
  });

  it('turns headings into paragraphs and images into links', () => {
    expect(renderMarkdown('# Loud')).toBe('<p>Loud</p>');
    expect(renderMarkdown('![cat](https://example.org/c.png)')).toContain(
      '<a href="https://example.org/c.png"',
    );
  });
});

describe('excerpt', () => {
  it('strips markup and shortens', () => {
    expect(excerpt('**Hello** _world_ & friends')).toBe('Hello world & friends');
    expect(excerpt('word '.repeat(100), 20)).toHaveLength(20);
  });
});
