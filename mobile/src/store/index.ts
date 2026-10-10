import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { deleteAttachment, clearLocalAttachments } from '../native/documents';
import { resolveSampleAttachments } from '../services/sample-assets';
import { createUnfoldStore, type UnfoldState } from './state';

export const unfoldStore = createUnfoldStore(AsyncStorage, {
  resolveSampleAttachments,
  deleteAttachments: async attachments => { await Promise.all(attachments.map(deleteAttachment)); },
  clearAllAttachments: clearLocalAttachments,
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
