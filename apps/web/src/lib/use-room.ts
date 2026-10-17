'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { RoomClient, type RoomState, type SocketLike } from './room-client';

/**
 * Joins a realtime room for as long as the component is mounted. `onEvent` gets each new event
 * once and in order (and 'resync' when the page should refetch). Returns live status, who is
 * here, who is typing, and `typing()` to announce yourself.
 */
export function useRoom(room: string, onEvent: (kind: string, data: unknown) => void) {
  const [state, setState] = useState<RoomState>({ status: 'connecting', presence: [], typing: [] });
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const client = useRef<RoomClient | null>(null);

  useEffect(() => {
    if (typeof WebSocket === 'undefined') {
      setState((s) => ({ ...s, status: 'offline' }));
      return;
    }
    const c = new RoomClient(
      room,
      { onState: setState, onEvent: (k, d) => handler.current(k, d) },
      {
        getToken: async (r) => {
          try {
            return await api<{ token: string; url: string }>('/api/realtime/token', { room: r });
          } catch (err) {
            // Not configured (503), or no access (401/403): stop. Anything else: retry later.
            return err instanceof ApiError && [401, 403, 503].includes(err.status)
              ? 'denied'
              : null;
          }
        },
        openSocket: (url, protocols) => adapt(new WebSocket(url, protocols)),
        now: () => Date.now(),
        random: Math.random,
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
      },
    );
    client.current = c;
    c.start();
    // Expired typing entries disappear without waiting for the next message.
    const sweep = window.setInterval(
      () =>
        setState((s) =>
          s.typing.some((t) => t.until <= Date.now())
            ? { ...s, typing: s.typing.filter((t) => t.until > Date.now()) }
            : s,
        ),
      1000,
    );
    return () => {
      window.clearInterval(sweep);
      c.stop();
      client.current = null;
    };
  }, [room]);

  return { ...state, typing: state.typing, sendTyping: () => client.current?.typing() };
}

/** Wraps a browser WebSocket in the small interface RoomClient uses. */
function adapt(ws: WebSocket): SocketLike {
  const s: SocketLike = {
    get readyState() {
      return ws.readyState;
    },
    send: (d) => ws.send(d),
    close: (code) => ws.close(code),
    onopen: null,
    onmessage: null,
    onclose: null,
  };
  ws.onopen = () => s.onopen?.();
  ws.onmessage = (e) => s.onmessage?.({ data: e.data });
  ws.onclose = (e) => s.onclose?.({ code: e.code });
  return s;
}
