import { useStore } from 'zustand';
import { deleteAttachment, clearLocalAttachments } from '../native/documents';
import { resolveSampleAttachments } from '../services/sample-assets';
import { createBrowserStorage } from './browser-storage';
import { createUnfoldStore, type UnfoldState } from './state';

const browserStorage = createBrowserStorage(() => {
  if (typeof window === 'undefined') throw new Error('browser_storage_unavailable');
  return window.localStorage;
});

export const unfoldStore = createUnfoldStore(browserStorage, {
  resolveSampleAttachments,
  deleteAttachments: async attachments => { await Promise.all(attachments.map(deleteAttachment)); },
  clearAllAttachments: clearLocalAttachments,
  // Static route rendering uses the initial snapshot. Only a browser opens saved user data.
  autoHydrate: typeof window !== 'undefined',
});

const identity = (state: UnfoldState) => state;
export const useUnfoldStore = Object.assign(
  function useUnfoldStore<T = UnfoldState>(selector: (state: UnfoldState) => T = identity as (state: UnfoldState) => T): T {
    return useStore(unfoldStore, selector);
  },
  unfoldStore,
);

export * from './state';
export * from './persistence';
export * from './browser-storage';
