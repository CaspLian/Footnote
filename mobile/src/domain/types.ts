export type Language = 'en' | 'es';
export type Locale = Language;
export type LocalizedText = Record<Language, string>;
export type DocumentKind = 'auto' | 'bill' | 'eob' | 'policy';
export type CaseStatus = 'needs_details' | 'ready' | 'action_prepared' | 'submitted' | 'resolved';
export type DraftKind = 'billing_correction' | 'insurer_appeal';
export type IconWeight = 'regular' | 'bold' | 'thin';

export type Relationship = 'self' | 'child' | 'partner' | 'dependent' | 'other';
export type Coverage = 'private' | 'medicare' | 'medicaid' | 'uninsured' | 'unsure';
export type ExplanationDepth = 'simple' | 'detailed';
export interface FamilyProfile {
  id: string;
  firstName: string;
  relationship: Relationship;
  relationshipLabel?: string;
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
  /** The required numeric storage slot is a placeholder until the missing amount is confirmed in Verify. */
  amountMissing?: boolean;
  evidence: Evidence;
}
export interface Financials {
  billedCents?: Money;
  adjustmentCents?: Money;
  postAdjustmentCents?: Money;
  /** Allowed amount is sourced from the EOB, never inferred from a statement. */
  allowedCents?: Money;
  insurerPaidCents?: Money;
  patientResponsibilityCents?: Money;
  patientPaidCents?: Money;
  remainingCents?: Money;
  eobBilledCents?: Money;
  eobResponsibilityCents?: Money;
  deductibleCents?: Money;
  coinsuranceCents?: Money;
  copaymentCents?: Money;
}
/** What the Footnote backend read from the imported pages (POST /api/v1/analyze), kept for verification and review. */
export interface ExtractedAnalysis {
  language?: string;
  /** Canonical document values: changed confirmed inputs must not play the original monetary explanation. */
  inputFingerprint?: string;
  model: string;
  /** True when the backend ran in MOCK mode: the result is a fixed sample, not this document. */
  mock: boolean;
  /** The saved analysis in Tiger Data, used for the ElevenLabs reading; absent when the backend could not save it. */
  auditId?: string;
  /** Gemini's notes on lines that look off, by line id; the review turns them into questions with their evidence. */
  notes?: Record<string, string[]>;
  documentType: string;
  summary: LocalizedText;
  questions: LocalizedText[];
  issues: LocalizedText[];
  totalBilledCents?: Money;
  patientOwesCents?: Money;
  dueDate?: string;
  parsedAt: string;
}
export interface Comparison {
  source: string;
  url: string;
  amountCents: Money;
  retrievedAt: string;
  context: LocalizedText;
  /** A physician-only reference cannot classify a hospital's total charge. */
  doctorOnly?: boolean;
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
export interface BillCase {
  id: string;
  profileId?: string;
  /** Backend reference for the currently attached and confirmed evidence. */
  evidenceContextId?: string;
  provider: string;
  serviceDate: string;
  description: LocalizedText;
  status: CaseStatus;
  source: 'sample' | 'manual';
  attachments: DocumentAttachment[];
  lineItems: LineItem[];
  financials: Financials;
  extraction?: ExtractedAnalysis;
  findings: Finding[];
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  followUpDate?: string;
  noticeDeadline?: string;
  /** True when confirmed values differ from their original extraction or synthetic documents. */
  entriesEdited?: boolean;
  reviewMode?: 'synthetic' | 'manual' | 'connected';
  /** Prevents repeating the optional image-only date recovery, including failed attempts. */
  dateRecoveryAttempted?: boolean;
  /** The case's claim in Tiger Data (POST /api/v1/claims), recorded when the case is first confirmed. */
  claimId?: string;
  /** The claim's deadlines from Tiger Data: estimates from the bill's dates until the user confirms a date. */
  claimDeadlines?: ClaimDeadlines;
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
  mode: 'synthetic' | 'manual' | 'connected';
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
/** A step in a case's claim in Tiger Data. finalCents is the statement balance when the user marked it resolved. */
export type ClaimChange =
  | { status: 'audit_complete' | 'dispute_in_progress' }
  | { collectionDeadline: string }
  | { finalCents: Money }
  | { action: string; note?: string };
/** YYYY-MM-DD dates; an estimate is computed by Tiger Data from the bill's dates, not read from a notice. */
export interface ClaimDeadlines {
  collectionDeadline?: string;
  collectionIsEstimate: boolean;
  creditWarningDate?: string;
  creditWarningIsEstimate: boolean;
}
/** Keeps a case's claim in Tiger Data in step with the app (services/claim-tracker.ts). */
export interface ClaimTracker {
  /** Records a confirmed case; resolves to its claim id, or undefined when there is nothing to record. */
  record(billCase: BillCase): Promise<string | undefined>;
  update(claimId: string, change: ClaimChange): Promise<void>;
  /** The claim's current deadlines, or undefined when they cannot be read. */
  deadlines(claimId: string): Promise<ClaimDeadlines | undefined>;
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
