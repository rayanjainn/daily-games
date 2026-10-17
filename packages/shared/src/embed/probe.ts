import type { EmbedMode } from '../domain';
import type { HeaderVerdict } from './headers';

/** Server-side request result: framing headers plus whether the page is up at all. */
export type HeaderProbe =
  ({ ok: true; status: number; finalUrl: string } & HeaderVerdict) | { ok: false; error: string };

/** What a real browser saw when it framed the page. */
export interface BrowserProbe {
  /** the frame's load event fired */
  loaded: boolean;
  /** the browser refused to render it (console "Refused to display/frame", error page) */
  refused: boolean;
  /** loaded but empty after waiting */
  blank: boolean;
  /** the page tried to navigate the top window (frame busting) */
  frameBusting: boolean;
  status: number | null;
  detail: string;
}

export interface Proposal {
  mode: EmbedMode;
  /** true when the proposal differs from the catalog */
  changed: boolean;
  live: boolean;
  why: string;
}

/**
 * Decides the embed mode a game should have. Iframe needs every signal to agree: headers that
 * do not block us, a frame that loads with content, and no frame busting. Anything uncertain
 * stays popout. A passing probe is necessary, not sufficient: the publisher must also permit
 * embedding, which a human confirms before a YAML file is switched to iframe.
 */
export function proposeMode(
  current: EmbedMode,
  header: HeaderProbe,
  browser: BrowserProbe | null,
): Proposal {
  if (current === 'native')
    return { mode: 'native', changed: false, live: true, why: 'our own game' };
  if (!header.ok) {
    return {
      mode: 'popout',
      changed: current !== 'popout',
      live: false,
      why: `unreachable: ${header.error}`,
    };
  }
  const live = header.status < 400;
  const popout = (why: string): Proposal => ({
    mode: 'popout',
    changed: current !== 'popout',
    live,
    why,
  });
  if (!live) return popout(`HTTP ${header.status}`);
  if (header.verdict === 'blocked') return popout(header.reason);
  if (!browser) return popout('no browser check');
  if (browser.refused) return popout(`browser refused: ${browser.detail}`);
  if (browser.frameBusting) return popout('the page breaks out of frames');
  if (!browser.loaded) return popout(`frame did not load: ${browser.detail}`);
  if (browser.blank) return popout('frame stayed blank');
  return {
    mode: 'iframe',
    changed: current !== 'iframe',
    live,
    why: `${header.reason}; loaded in a frame`,
  };
}
