import { isRelationshipLabel } from '../domain/profiles';
import { isMoney } from '../domain/money';
import type { AppealDraft, BillCase, CaseEvent, FamilyProfile, PersonalContext, IconWeight, Language } from '../domain/types';
import { normalizePreferences, type AppPreferences } from '../domain/preferences';

export const STORAGE_KEY = 'unfold-local-v1';
export interface PersistedSnapshot {
  preferences: AppPreferences;
  savedTermIds: string[];
  version: 1;
  locale: Language;
  welcomeCompleted: boolean;
  onboardingCompleted: boolean;
  profiles: FamilyProfile[];
  activeProfileId?: string;
  personalContext: PersonalContext;
  iconWeight: IconWeight;
  iconSize: number;
  duotoneOpacity: number;
  cases: BillCase[];
  drafts: AppealDraft[];
  events: CaseEvent[];
  activeCaseId?: string;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const localized = (value: unknown): boolean => record(value) && text(value.en) && text(value.es);
const evidence = (value: unknown): boolean => record(value) && text(value.attachmentId) && Number.isSafeInteger(value.page)
  && (value.page as number) >= 1 && localized(value.label) && localized(value.excerpt);

function validCase(value: unknown): boolean {
  if (!record(value) || !text(value.id) || !text(value.provider) || !text(value.serviceDate)
      || !localized(value.description) || !text(value.createdAt) || !text(value.updatedAt)
      || !['sample', 'manual'].includes(value.source as string)
      || !['needs_details', 'ready', 'action_prepared', 'submitted', 'resolved'].includes(value.status as string)
      || !record(value.financials) || !Array.isArray(value.attachments) || !Array.isArray(value.lineItems) || !Array.isArray(value.findings)) return false;
  const financials = value.financials;
  if (!Object.values(financials).every(amount => amount === undefined || isMoney(amount))) return false;
  if (!value.attachments.every(a => record(a) && text(a.id) && text(a.uri) && text(a.name) && text(a.mimeType)
    && ['auto', 'bill', 'eob', 'policy'].includes(a.kind as string) && ['sample', 'import'].includes(a.origin as string) && text(a.importedAt))) return false;
  if (!value.lineItems.every(line => record(line) && text(line.id) && localized(line.description) && text(line.date)
    && Number.isSafeInteger(line.units) && (line.units as number) >= 1 && isMoney(line.billedCents) && evidence(line.evidence))) return false;
  return value.findings.every(finding => record(finding) && text(finding.id) && localized(finding.title)
    && localized(finding.explanation) && localized(finding.question) && Array.isArray(finding.evidence) && finding.evidence.every(evidence)
    && ['needs_clarification', 'worth_asking'].includes(finding.label as string)
    && ['billing_correction', 'insurer_appeal'].includes(finding.action as string));
}

export function parseSnapshot(serialized: string): PersistedSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!record(value) || value.version !== 1 || !['en', 'es'].includes(value.locale as string)
    || typeof value.welcomeCompleted !== 'boolean' || !['regular', 'bold', 'thin'].includes(value.iconWeight as string)
    || typeof value.iconSize !== 'number' || !Number.isFinite(value.iconSize) || value.iconSize < 16 || value.iconSize > 32
    || typeof value.duotoneOpacity !== 'number' || !Number.isFinite(value.duotoneOpacity) || value.duotoneOpacity < 0 || value.duotoneOpacity > 1
    || !Array.isArray(value.cases) || !value.cases.every(validCase)
    || !Array.isArray(value.drafts) || !value.drafts.every(draft => record(draft) && text(draft.id) && text(draft.caseId)
      && text(draft.body) && text(draft.updatedAt) && ['en', 'es'].includes(draft.locale as string)
      && ['billing_correction', 'insurer_appeal'].includes(draft.kind as string) && Number.isSafeInteger(draft.revision) && (draft.revision as number) >= 1)
    || !Array.isArray(value.events) || !value.events.every(event => record(event) && text(event.id) && text(event.caseId) && text(event.at)
      && ['imported', 'verified', 'draft_prepared', 'submitted', 'follow_up_set', 'follow_up_removed', 'resolved', 'deadline_set', 'deadline_removed'].includes(event.kind as string))) {
    throw new Error('saved_data_unreadable');
  }
  const ids = new Set(value.cases.map(item => item.id));
  if (ids.size !== value.cases.length || value.drafts.some(draft => !ids.has(draft.caseId)) || value.events.some(event => !ids.has(event.caseId))) {
    throw new Error('saved_data_unreadable');
  }
  const profiles = value.profiles ?? [];
  if (!Array.isArray(profiles) || !profiles.every(p => record(p) && text(p.id) && text(p.firstName) && p.firstName.trim().length > 0 && ['self','child','partner','dependent','other'].includes(p.relationship as string) && (p.relationship !== 'other' || isRelationshipLabel(p.relationshipLabel)) && text(p.zipCode) && (!p.zipCode || /^\d{5}$/.test(p.zipCode)) && ['private','medicare','medicaid','uninsured','unsure'].includes(p.coverage as string) && text(p.insurer) && text(p.planName))) throw new Error('saved_data_unreadable');
  if (new Set(profiles.map(p => p.id)).size !== profiles.length || profiles.filter(p => p.relationship === 'self').length > 1) throw new Error('saved_data_unreadable');
  const context = value.personalContext ?? { explanationDepth: 'simple', goal: 'understand' };
  if (!record(context) || !['simple','detailed'].includes(context.explanationDepth as string) || !['understand','check_charges','prepare_request'].includes(context.goal as string)) throw new Error('saved_data_unreadable');
  // Return only known persistent fields. Stored content never overrides actions.
  return {
    preferences: normalizePreferences(value.preferences),
    savedTermIds: Array.isArray(value.savedTermIds) ? [...new Set(value.savedTermIds.filter((id): id is string => text(id) && id.length > 0 && id.length <= 80))] : [],
    version: 1, onboardingCompleted: value.onboardingCompleted === true && profiles.some(p => p.relationship === 'self'), profiles: profiles as FamilyProfile[], activeProfileId: text(value.activeProfileId) && profiles.some(p => p.id === value.activeProfileId) ? value.activeProfileId : profiles[0]?.id, personalContext: context as unknown as PersonalContext, locale: value.locale as Language, welcomeCompleted: value.welcomeCompleted,
    iconWeight: value.iconWeight as IconWeight, iconSize: value.iconSize, duotoneOpacity: value.duotoneOpacity,
    cases: value.cases as BillCase[], drafts: value.drafts as AppealDraft[], events: value.events as CaseEvent[],
    activeCaseId: text(value.activeCaseId) && ids.has(value.activeCaseId) ? value.activeCaseId : undefined,
  };
}
