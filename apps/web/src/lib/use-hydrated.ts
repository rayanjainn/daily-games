import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during SSR and until React hydrates. Submit buttons stay disabled until then, so a fast
 * tap on a slow device can't trigger a native form submit that reloads the page and drops input.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
