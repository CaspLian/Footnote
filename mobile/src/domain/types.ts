export type Language = 'en' | 'es';
export type Locale = Language;
export type LocalizedText = Record<Language, string>;
export type DocumentKind = 'bill' | 'eob' | 'policy';
export type CaseStatus = 'needs_details' | 'ready' | 'action_prepared' | 'submitted' | 'resolved';
export type DraftKind = 'billing_correction' | 'insurer_appeal';
export type IconWeight = 'regular' | 'bold' | 'thin';

export type Relationship = 'self' | 'child' | 'partner' | 'dependent';
export type Coverage = 'private' | 'medicare' | 'medicaid' | 'uninsured' | 'unsure';
export type ExplanationDepth = 'simple' | 'detailed';
export interface FamilyProfile {
  id: string;
  firstName: string;
  relationship: Relationship;
  ageGroup?: 'under18' | 'adult' | 'over65';
  zipCode: string;
  coverage: Coverage;
  insurer: string;
  planName: string;
}
export interface PersonalContext {
  explanationDepth: ExplanationDepth;
  goal: 'understand' | 'check_charges' | 'prepare_request';
}

/** USD cents. Values must be finite, nonnegative safe integers. */
export type Money = number;
export interface DocumentAttachment {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: DocumentKind;
  origin: 'sample' | 'import';
  importedAt: string;
  pageCount?: number;
}
export interface Evidence {
  attachmentId: string;
  page: number;
  label: LocalizedText;
  excerpt: LocalizedText;
}
export interface LineItem {
  id: string;
  description: LocalizedText;
  code?: string;
  date: string;
  units: number;
  billedCents: Money;
  evidence: Evidence;
}
export interface Financials {
  billedCents: Money;
  adjustmentCents: Money;
  postAdjustmentCents: Money;
  /** Allowed amount is sourced from the EOB, never inferred from a statement. */
  allowedCents?: Money;
  insurerPaidCents?: Money;
  patientResponsibilityCents?: Money;
  patientPaidCents: Money;
  remainingCents: Money;
  eobBilledCents?: Money;
  eobResponsibilityCents?: Money;
  deductibleCents?: Money;
  coinsuranceCents?: Money;
  copaymentCents?: Money;
}
export interface Comparison {
  source: string;
  url: string;
  amountCents: Money;
  retrievedAt: string;
  context: LocalizedText;
}
export interface Finding {
  id: string;
  title: LocalizedText;
  explanation: LocalizedText;
  question: LocalizedText;
  label: 'needs_clarification' | 'worth_asking';
  evidence: Evidence[];
  comparison?: Comparison;
  action: DraftKind;
}
/** What the ClaimPulse backend read from the first imported document (POST /api/v1/analyze). */
export interface CaseAnalysis {
  /** The saved analysis in Tiger Data; absent when the backend could not save it. */
  auditId?: string;
  /** The language Gemini answered in; the texts below are in it. */
  language: Language;
  summary: string;
  questions: string[];
  /** Gemini's notes on lines that look off, by line id. */
  notes: Record<string, string[]>;
  /** True when the backend ran in MOCK mode: the result is a fixed sample, not this document. */
  mock: boolean;
  analyzedAt: string;
}
export interface BillCase {
  id: string;
  profileId?: string;
  provider: string;
  serviceDate: string;
  description: LocalizedText;
  status: CaseStatus;
  source: 'sample' | 'manual';
  attachments: DocumentAttachment[];
  lineItems: LineItem[];
  financials: Financials;
  findings: Finding[];
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  followUpDate?: string;
  noticeDeadline?: string;
  /** True when confirmed values differ from the original synthetic documents. */
  entriesEdited?: boolean;
  reviewMode?: 'synthetic' | 'manual';
  analysis?: CaseAnalysis;
}
export interface AppealDraft {
  id: string;
  caseId: string;
  kind: DraftKind;
  locale: Language;
  body: string;
  revision: number;
  updatedAt: string;
  submittedAt?: string;
}
export type CaseEventKind = 'imported' | 'verified' | 'draft_prepared' | 'submitted' | 'follow_up_set' | 'follow_up_removed' | 'resolved' | 'deadline_set' | 'deadline_removed';
export interface CaseEvent {
  id: string;
  caseId: string;
  kind: CaseEventKind;
  at: string;
  draftKind?: DraftKind;
  draftId?: string;
  date?: string;
}
export interface ReviewResult {
  mode: 'synthetic' | 'manual';
  findings: Finding[];
  summary: LocalizedText;
}
export interface DocumentService {
  processBill(billCase: BillCase): Promise<ReviewResult>;
}
export interface BenchmarkService {
  lookup(lineItem: LineItem): Promise<Comparison | null>;
}
export interface DraftService {
  prepare(billCase: BillCase, kind: DraftKind, locale: Language): Promise<string>;
}
export interface NarrationService {
  speak(text: string, language: Language): Promise<void>;
  stop(): Promise<void>;
}
export interface GlossaryTerm {
  id: string;
  title: LocalizedText;
  definition: LocalizedText;
  example: LocalizedText;
  source: { title: string; url: string };
}
