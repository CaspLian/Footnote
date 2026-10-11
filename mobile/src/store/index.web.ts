import { useStore } from 'zustand';
import { deleteAttachment, clearLocalAttachments } from '../native/documents';
import { resolveSampleAttachments } from '../services/sample-assets';
import { createBrowserStorage } from './browser-storage';
import { createFootnoteStore, type FootnoteState } from './state';

const browserStorage = createBrowserStorage(() => {
  if (typeof window === 'undefined') throw new Error('browser_storage_unavailable');
  return window.localStorage;
});

export const footnoteStore = createFootnoteStore(browserStorage, {
  resolveSampleAttachments,
  deleteAttachments: async attachments => { await Promise.all(attachments.map(deleteAttachment)); },
  clearAllAttachments: clearLocalAttachments,
  // Static route rendering uses the initial snapshot. Only a browser opens saved user data.
  autoHydrate: typeof window !== 'undefined',
});

const identity = (state: FootnoteState) => state;
export const useFootnoteStore = Object.assign(
  function useFootnoteStore<T = FootnoteState>(selector: (state: FootnoteState) => T = identity as (state: FootnoteState) => T): T {
    return useStore(footnoteStore, selector);
  },
  footnoteStore,
);

export * from './state';
export * from './persistence';
export * from './browser-storage';
