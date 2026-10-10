import { createStore } from 'zustand/vanilla';
import { createManualCase, createSampleCase, SAMPLE_CASE_ID } from '../domain/fixtures';
import { isISODate, isMoney } from '../domain/money';
import { validateCase } from '../domain/review';
import type { AppealDraft, BillCase, CaseEvent, ClaimChange, ClaimTracker, DocumentAttachment, DraftKind, FamilyProfile, PersonalContext, IconWeight, Language, ReviewResult } from '../domain/types';
import { claimTracker } from '../services/claim-tracker';
import { documentService } from '../services/connected-services';
import { draftService, sampleEntriesChanged } from '../services/local-services';
import { parseSnapshot, STORAGE_KEY, type PersistedSnapshot } from './persistence';

export interface LocalStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): unknown | Promise<unknown>;
  removeItem(key: string): unknown | Promise<unknown>;
}
export interface UnfoldState {
  locale: Language;
  welcomeCompleted: boolean;
  onboardingCompleted: boolean;
  profiles: FamilyProfile[];
  activeProfileId?: string;
  personalContext: PersonalContext;
  completeOnboarding(profile: Omit<FamilyProfile, 'id'>, context: PersonalContext): void;
  saveProfile(profile: Omit<FamilyProfile, 'id'> & { id?: string }): string;
  removeProfile(id: string): void;
  setActiveProfile(id: string): void;
  assignCaseProfile(caseId: string, profileId: string): void;
  setExplanationDepth(depth: PersonalContext['explanationDepth']): void;
  markResolved(caseId: string): void;
  setNoticeDeadline(caseId: string, date: string | null): void;
  iconWeight: IconWeight;
  iconSize: number;
  duotoneOpacity: number;
  cases: BillCase[];
  drafts: AppealDraft[];
  events: CaseEvent[];
  activeCaseId?: string;
  hydrated: boolean;
  hydrationError: string | null;
  storageError: string | null;
  processingCaseIds: string[];
  setLocale(locale: Language): void;
  completeWelcome(): void;
  setIconPreferences(preferences: Partial<Pick<UnfoldState, 'iconWeight' | 'iconSize' | 'duotoneOpacity'>>): void;
  setActiveCase(caseId: string): void;
  loadSample(): Promise<string>;
  addManualCase(): string;
  addImportedCase(attachment: DocumentAttachment): string;
  addAttachment(caseId: string, attachment: DocumentAttachment): void;
  updateAttachment(caseId: string, attachmentId: string, kind: DocumentAttachment['kind']): void;
  removeAttachment(caseId: string, attachmentId: string): Promise<void>;
  updateCase(caseId: string, patch: Partial<Pick<BillCase, 'provider' | 'serviceDate' | 'description' | 'financials' | 'lineItems' | 'extraction' | 'findings'>>): void;
  verifyCase(caseId: string): Promise<void>;
  prepareDraft(caseId: string, kind: DraftKind): Promise<string>;
  saveDraft(caseId: string, kind: DraftKind, body: string, locale: Language): string;
  markSubmitted(draftId: string): void;
  setFollowUp(caseId: string, date: string | null): void;
  deleteCase(caseId: string): Promise<void>;
  resetDemo(): Promise<void>;
  retryHydration(): Promise<void>;
  recoverEmpty(): Promise<void>;
  retryPersistence(): Promise<void>;
  /** Mainly for deterministic tests and an explicit save boundary. */
  flushPersistence(): Promise<void>;
}
export interface StoreOptions {
  now?: () => string;
  id?: (prefix: string) => string;
  resolveSampleAttachments?: (locale: Language, at: string) => Promise<DocumentAttachment[]>;
  processBill?: (billCase: BillCase) => Promise<ReviewResult>;
  deleteAttachments?: (attachments: DocumentAttachment[]) => Promise<void>;
  clearAllAttachments?: () => Promise<void>;
  /** Tiger Data claim tracking; the default calls the backend when EXPO_PUBLIC_API_URL is set. */
  claims?: ClaimTracker;
  autoHydrate?: boolean;
}

const emptyData = () => ({
  locale: 'en' as Language, welcomeCompleted: false, onboardingCompleted: false, profiles: [] as FamilyProfile[], activeProfileId: undefined as string | undefined, personalContext: { explanationDepth: 'simple', goal: 'understand' } as PersonalContext, iconWeight: 'regular' as IconWeight,
  iconSize: 24, duotoneOpacity: 0.2, cases: [] as BillCase[], drafts: [] as AppealDraft[], events: [] as CaseEvent[], activeCaseId: undefined as string | undefined,
});

export function snapshotOf(state: UnfoldState): PersistedSnapshot {
  return {
    version: 1, onboardingCompleted: state.onboardingCompleted, profiles: state.profiles, activeProfileId: state.activeProfileId, personalContext: state.personalContext, locale: state.locale, welcomeCompleted: state.welcomeCompleted, iconWeight: state.iconWeight,
    iconSize: state.iconSize, duotoneOpacity: state.duotoneOpacity, cases: state.cases, drafts: state.drafts,
    events: state.events, activeCaseId: state.activeCaseId,
  };
}

/** Pure store with injected I/O so persistence and failure paths run in Node tests. */
export function createUnfoldStore(storage: LocalStorage, options: StoreOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const makeId = options.id ?? ((prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  let pendingSave: Promise<void> = Promise.resolve();
  let hydration: Promise<void> | undefined;
  const inFlightReviews = new Map<string, Promise<void>>();
  let generation = 0;

  const store = createStore<UnfoldState>()((set, get) => {
    const ensureWritable = () => {
      if (!get().hydrated || get().hydrationError) throw new Error('storage_not_loaded');
    };
    const persist = () => {
      const serialized = JSON.stringify(snapshotOf(get()));
      pendingSave = pendingSave.then(async () => {
        try { await storage.setItem(STORAGE_KEY, serialized); set({ storageError: null }); }
        catch { set({ storageError: 'storage_unavailable' }); }
      });
    };
    const change = (patch: Partial<UnfoldState>) => { ensureWritable(); set(patch); persist(); };
    const claims = options.claims ?? claimTracker;
    // Keeps the case's claim in Tiger Data in step: recorded on the first confirmation (then "audit complete"), and
    // updated after later steps. It is a side record, so a failure never reaches the user or changes the case.
    const trackClaim = async (caseId: string, step?: ClaimChange) => {
      try {
        const current = get().cases.find(item => item.id === caseId);
        if (!current || current.source === 'sample') return;
        let claimId = current.claimId;
        if (!claimId) {
          if (step) return; // nothing recorded yet, so nothing to update
          claimId = await claims.record(current);
          if (!claimId || !get().cases.some(item => item.id === caseId)) return;
          const recorded = claimId;
          change({ cases: get().cases.map(item => item.id === caseId ? { ...item, claimId: recorded } : item) });
        }
        await claims.update(claimId, step ?? { status: 'audit_complete' });
      } catch { /* Tiger Data unavailable: the app's own record stays complete. */ }
    };
    const caseById = (id: string) => {
      const billCase = get().cases.find(item => item.id === id);
      if (!billCase) throw new Error('case_not_found');
      return billCase;
    };
    const event = (caseId: string, kind: CaseEvent['kind'], extra: Partial<CaseEvent> = {}): CaseEvent => ({ id: makeId('event'), caseId, kind, at: now(), ...extra });
    const saveDraft = (caseId: string, kind: DraftKind, body: string, locale: Language): string => {
      ensureWritable(); caseById(caseId);
      const existing = get().drafts.find(draft => draft.caseId === caseId && draft.kind === kind && draft.locale === locale);
      if (existing && existing.body === body) return existing.id;
      const timestamp = now();
      const draft: AppealDraft = {
        id: existing?.id ?? makeId('draft'), caseId, kind, locale, body, updatedAt: timestamp,
        revision: existing ? existing.revision + (existing.submittedAt ? 1 : 0) : 1,
      };
      change({
        drafts: existing ? get().drafts.map(item => item.id === draft.id ? draft : item) : [...get().drafts, draft],
        cases: get().cases.map(item => item.id === caseId ? { ...item, status: 'action_prepared', updatedAt: timestamp } : item),
        events: existing ? get().events : [...get().events, event(caseId, 'draft_prepared', { draftKind: kind, draftId: draft.id })],
      });
      return draft.id;
    };
    const retryHydration = async () => {
      if (hydration) return hydration;
      set({ hydrated: false, hydrationError: null });
      hydration = (async () => {
        try {
          const serialized = await storage.getItem(STORAGE_KEY);
          const snapshot = serialized === null ? undefined : parseSnapshot(serialized);
          if (snapshot) {
            // Native caches may be cleared and web asset hashes may change after a new build.
            // Rebind existing synthetic documents without restoring attachments the user removed.
            if (options.resolveSampleAttachments && snapshot.cases.some(billCase => billCase.source === 'sample')) {
              try {
                const currentAssets = await options.resolveSampleAttachments(snapshot.locale, now());
                snapshot.cases = snapshot.cases.map(billCase => billCase.source !== 'sample' ? billCase : {
                  ...billCase,
                  attachments: billCase.attachments.map(attachment => {
                    const fresh = attachment.origin === 'sample' ? currentAssets.find(item => item.id === attachment.id) : undefined;
                    return fresh ? { ...attachment, uri: fresh.uri } : attachment;
                  }),
                });
              } catch {
                // Saved entries/drafts remain usable. Document preview offers recovery separately.
              }
            }
            const { version: _version, ...data } = snapshot;
            set({ ...data, hydrated: true, hydrationError: null, storageError: null });
          } else set({ hydrated: true, hydrationError: null });
        } catch { set({ hydrated: true, hydrationError: 'saved_data_unreadable' }); }
        finally { hydration = undefined; }
      })();
      return hydration;
    };
    return {
      ...emptyData(), hydrated: false, hydrationError: null, storageError: null, processingCaseIds: [],
      setLocale(locale) { if (locale !== 'en' && locale !== 'es') return; change({ locale }); },
      completeWelcome() { change({ welcomeCompleted: true }); },
      completeOnboarding(profile, context) {
        const existing = get().profiles.find(p => p.relationship === 'self');
        const id = get().saveProfile({ ...profile, relationship: 'self', id: existing?.id });
        change({ onboardingCompleted: true, welcomeCompleted: true, activeProfileId: id, personalContext: context, locale: 'en' });
      },
      saveProfile(input) {
        if (!input.firstName.trim() || input.firstName.trim().length > 80 || (input.zipCode && !/^\d{5}$/.test(input.zipCode))) throw new Error('invalid_profile');
        if (!['self','child','partner','dependent'].includes(input.relationship) || !['private','medicare','medicaid','uninsured','unsure'].includes(input.coverage)) throw new Error('invalid_profile');
        const current = input.id ? get().profiles.find(p => p.id === input.id) : undefined;
        if (input.id && !current) throw new Error('profile_not_found');
        if (input.relationship === 'self' && get().profiles.some(p => p.relationship === 'self' && p.id !== input.id)) throw new Error('duplicate_self_profile');
        const profile = { ...input, id: current?.id ?? makeId('profile'), firstName: input.firstName.trim(), insurer: input.insurer.trim(), planName: input.planName.trim() };
        change({ profiles: current ? get().profiles.map(p => p.id === profile.id ? profile : p) : [...get().profiles, profile] });
        return profile.id;
      },
      removeProfile(id) {
        const profile = get().profiles.find(p => p.id === id);
        if (!profile || profile.relationship === 'self') throw new Error('cannot_remove_primary_profile');
        const fallback = get().profiles.find(p => p.relationship === 'self')?.id;
        change({ profiles: get().profiles.filter(p => p.id !== id), activeProfileId: get().activeProfileId === id ? fallback : get().activeProfileId, cases: get().cases.map(c => c.profileId === id ? { ...c, profileId: undefined } : c) });
      },
      setActiveProfile(id) { if (!get().profiles.some(p => p.id === id)) throw new Error('profile_not_found'); change({ activeProfileId: id }); },
      assignCaseProfile(caseId, profileId) { caseById(caseId); if (!get().profiles.some(p => p.id === profileId)) throw new Error('profile_not_found'); change({ cases: get().cases.map(c => c.id === caseId ? { ...c, profileId, updatedAt: now() } : c) }); },
      setExplanationDepth(depth) { if (depth !== 'simple' && depth !== 'detailed') return; change({ personalContext: { ...get().personalContext, explanationDepth: depth } }); },
      markResolved(caseId) { const c = caseById(caseId); if (c.status === 'resolved') return; change({ cases: get().cases.map(c => c.id === caseId ? { ...c, status: 'resolved', updatedAt: now() } : c), events: [...get().events, event(caseId, 'resolved')] }); void trackClaim(caseId, { finalCents: c.financials.remainingCents }); },
      setNoticeDeadline(caseId, date) { const c = caseById(caseId); if (date !== null && !isISODate(date)) throw new Error('invalid_date'); if ((c.noticeDeadline ?? null) === date) return; change({ cases: get().cases.map(c => c.id === caseId ? { ...c, noticeDeadline: date ?? undefined, updatedAt: now() } : c), events: [...get().events, event(caseId, date ? 'deadline_set' : 'deadline_removed', date ? { date } : {})] }); if (date !== null) void trackClaim(caseId, { collectionDeadline: date }); },
      setIconPreferences(preferences) {
        const patch: Partial<UnfoldState> = {};
        if (preferences.iconWeight && ['regular', 'bold', 'thin'].includes(preferences.iconWeight)) patch.iconWeight = preferences.iconWeight;
        if (typeof preferences.iconSize === 'number' && Number.isFinite(preferences.iconSize)) patch.iconSize = Math.min(32, Math.max(16, preferences.iconSize));
        if (typeof preferences.duotoneOpacity === 'number' && Number.isFinite(preferences.duotoneOpacity)) patch.duotoneOpacity = Math.min(1, Math.max(0, preferences.duotoneOpacity));
        change(patch);
      },
      setActiveCase(caseId) { caseById(caseId); change({ activeCaseId: caseId }); },
      async loadSample() {
        ensureWritable();
        if (get().cases.some(item => item.id === SAMPLE_CASE_ID)) { change({ activeCaseId: SAMPLE_CASE_ID, welcomeCompleted: true }); return SAMPLE_CASE_ID; }
        const timestamp = now(); const token = generation;
        const sample = { ...createSampleCase(SAMPLE_CASE_ID, timestamp), profileId: get().activeProfileId };
        if (options.resolveSampleAttachments) sample.attachments = await options.resolveSampleAttachments(get().locale, timestamp);
        if (token !== generation) throw new Error('operation_cancelled');
        // Recheck after I/O so tapping twice creates only one case/event.
        if (!get().cases.some(item => item.id === SAMPLE_CASE_ID)) {
          change({ cases: [sample, ...get().cases], events: [...get().events, event(sample.id, 'imported')], activeCaseId: sample.id, welcomeCompleted: true });
        }
        return SAMPLE_CASE_ID;
      },
      addManualCase() {
        const billCase = { ...createManualCase(undefined, makeId('case'), now()), profileId: get().activeProfileId };
        change({ cases: [billCase, ...get().cases], activeCaseId: billCase.id, welcomeCompleted: true }); return billCase.id;
      },
      addImportedCase(attachment) {
        const imported = { ...attachment, origin: 'import' as const };
        const billCase = { ...createManualCase(imported, makeId('case'), now()), profileId: get().activeProfileId };
        change({ cases: [billCase, ...get().cases], events: [...get().events, event(billCase.id, 'imported')], activeCaseId: billCase.id, welcomeCompleted: true }); return billCase.id;
      },
      addAttachment(caseId, attachment) {
        const current = caseById(caseId);
        if (current.attachments.some(item => item.id === attachment.id)) return;
        // A newly imported document can never acquire sample provenance.
        const added = { ...attachment, origin: 'import' as const };
        change({ cases: get().cases.map(item => item.id === caseId ? { ...item, attachments: [...item.attachments, added], status: 'needs_details', findings: [], verifiedAt: undefined, updatedAt: now() } : item), events: [...get().events, event(caseId, 'imported')] });
      },
      updateAttachment(caseId, attachmentId, kind) {
        caseById(caseId);
        change({ cases: get().cases.map(item => item.id === caseId ? { ...item, attachments: item.attachments.map(a => a.id === attachmentId ? { ...a, kind } : a), status: 'needs_details', findings: [], verifiedAt: undefined, updatedAt: now() } : item) });
      },
      async removeAttachment(caseId, attachmentId) {
        const current = caseById(caseId); const removed = current.attachments.find(item => item.id === attachmentId);
        if (!removed) return;
        if (options.deleteAttachments) await options.deleteAttachments([removed]);
        change({ cases: get().cases.map(item => item.id === caseId ? { ...item, attachments: item.attachments.filter(a => a.id !== attachmentId), status: 'needs_details', findings: [], verifiedAt: undefined, updatedAt: now() } : item) });
      },
      updateCase(caseId, patch) {
        const original = caseById(caseId);
        if (patch.financials && Object.values(patch.financials).some(value => value !== undefined && !isMoney(value))) throw new Error('invalid_money');
        if (patch.lineItems && patch.lineItems.some(line => !isMoney(line.billedCents) || !Number.isSafeInteger(line.units) || line.units < 1)) throw new Error('invalid_line_item');
        const updated = { ...original, ...patch, status: 'needs_details' as const, findings: patch.findings ?? [], verifiedAt: undefined, updatedAt: now() };
        updated.entriesEdited = updated.source === 'sample' && sampleEntriesChanged(updated);
        change({ cases: get().cases.map(item => item.id === caseId ? updated : item) });
      },
      async verifyCase(caseId) {
        ensureWritable();
        if (inFlightReviews.has(caseId)) return inFlightReviews.get(caseId);
        const original = caseById(caseId);
        if (validateCase(original).length) throw new Error('verification_required');
        const token = generation;
        const inputSnapshot = JSON.stringify(original);
        const review = (async () => {
          set({ processingCaseIds: [...get().processingCaseIds, caseId] });
          try {
            const result = await (options.processBill ?? documentService.processBill)(original);
            const latest = get().cases.find(item => item.id === caseId);
            if (token !== generation || !latest || JSON.stringify(latest) !== inputSnapshot) throw new Error('details_changed_during_review');
            const timestamp = now();
            change({
              cases: get().cases.map(item => item.id === caseId ? { ...item, status: 'ready', findings: result.findings, reviewMode: result.mode, verifiedAt: timestamp, updatedAt: timestamp } : item),
              events: [...get().events, event(caseId, 'verified')],
            });
            void trackClaim(caseId);
          } finally { set({ processingCaseIds: get().processingCaseIds.filter(id => id !== caseId) }); inFlightReviews.delete(caseId); }
        })();
        inFlightReviews.set(caseId, review); return review;
      },
      saveDraft,
      async prepareDraft(caseId, kind) {
        ensureWritable(); const locale = get().locale; const billCase = caseById(caseId);
        const existing = get().drafts.find(draft => draft.caseId === caseId && draft.kind === kind && draft.locale === locale);
        if (existing) return existing.id;
        const name = get().profiles.find(p=>p.id===billCase.profileId)?.firstName;
        const body = (await draftService.prepare(billCase, kind, locale)).replace('[Your name]', name || '[Your name]');
        caseById(caseId);
        const duplicate = get().drafts.find(draft => draft.caseId === caseId && draft.kind === kind && draft.locale === locale);
        return duplicate?.id ?? saveDraft(caseId, kind, body, locale);
      },
      markSubmitted(draftId) {
        ensureWritable(); const draft = get().drafts.find(item => item.id === draftId);
        if (!draft) throw new Error('draft_not_found');
        if (!draft.body.trim()) throw new Error('draft_empty');
        if (draft.submittedAt) return;
        const timestamp = now(); const eventId = `${draft.id}:submitted:${draft.revision}`;
        change({
          drafts: get().drafts.map(item => item.id === draft.id ? { ...item, submittedAt: timestamp, updatedAt: timestamp } : item),
          cases: get().cases.map(item => item.id === draft.caseId ? { ...item, status: 'submitted', updatedAt: timestamp } : item),
          events: get().events.some(item => item.id === eventId) ? get().events : [...get().events, event(draft.caseId, 'submitted', { id: eventId, draftId: draft.id, draftKind: draft.kind })],
        });
        void trackClaim(draft.caseId, { status: 'dispute_in_progress' });
      },
      setFollowUp(caseId, date) {
        const current = caseById(caseId);
        if (date !== null && !isISODate(date)) throw new Error('invalid_date');
        if ((current.followUpDate ?? null) === date) return;
        change({ cases: get().cases.map(item => item.id === caseId ? { ...item, followUpDate: date ?? undefined, updatedAt: now() } : item), events: [...get().events, event(caseId, date ? 'follow_up_set' : 'follow_up_removed', date ? { date } : {})] });
      },
      async deleteCase(caseId) {
        const current = caseById(caseId);
        if (options.deleteAttachments) await options.deleteAttachments(current.attachments);
        change({ cases: get().cases.filter(item => item.id !== caseId), drafts: get().drafts.filter(item => item.caseId !== caseId), events: get().events.filter(item => item.caseId !== caseId), activeCaseId: get().activeCaseId === caseId ? undefined : get().activeCaseId });
      },
      async resetDemo() {
        ensureWritable(); generation += 1;
        const timestamp = now(); const sample = { ...createSampleCase(SAMPLE_CASE_ID, timestamp), profileId: get().activeProfileId };
        if (options.resolveSampleAttachments) sample.attachments = await options.resolveSampleAttachments(get().locale, timestamp);
        change({ cases: [sample, ...get().cases.filter(item => item.id !== SAMPLE_CASE_ID)], drafts: get().drafts.filter(item => item.caseId !== SAMPLE_CASE_ID), events: [...get().events.filter(item => item.caseId !== SAMPLE_CASE_ID), event(SAMPLE_CASE_ID, 'imported')], activeCaseId: SAMPLE_CASE_ID, welcomeCompleted: true });
      },
      retryHydration,
      async recoverEmpty() {
        generation += 1;
        await pendingSave;
        // Only called from an explicit recovery choice, never on a read failure.
        if (options.clearAllAttachments) await options.clearAllAttachments();
        await storage.removeItem(STORAGE_KEY);
        set({ ...emptyData(), hydrated: true, hydrationError: null, storageError: null, processingCaseIds: [] });
      },
      async retryPersistence() {
        ensureWritable(); await pendingSave;
        try { await storage.setItem(STORAGE_KEY, JSON.stringify(snapshotOf(get()))); set({ storageError: null }); }
        catch { set({ storageError: 'storage_unavailable' }); throw new Error('storage_unavailable'); }
      },
      async flushPersistence() { await pendingSave; },
    };
  });
  if (options.autoHydrate !== false) void store.getState().retryHydration();
  return store;
}
