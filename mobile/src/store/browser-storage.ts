import type { LocalStorage } from './state';

export interface BrowserStorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Resolve storage at operation time: SSR has no window, and browser storage can be blocked. */
export function createBrowserStorage(getBackend: () => BrowserStorageBackend): LocalStorage {
  return {
    getItem(key) { return getBackend().getItem(key); },
    setItem(key, value) { getBackend().setItem(key, value); },
    removeItem(key) { getBackend().removeItem(key); },
  };
}
