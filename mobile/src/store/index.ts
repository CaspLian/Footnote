import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { deleteAttachment, clearLocalAttachments } from '../native/documents';
import { resolveSampleAttachments } from '../services/sample-assets';
import { createFootnoteStore, type FootnoteState } from './state';

export const footnoteStore = createFootnoteStore(AsyncStorage, {
  resolveSampleAttachments,
  deleteAttachments: async attachments => { await Promise.all(attachments.map(deleteAttachment)); },
  clearAllAttachments: clearLocalAttachments,
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
