export type Language = 'en' | 'es';

export type ActiveTab =
  | 'dashboard'
  | 'bills'
  | 'intake'
  | 'verification'
  | 'review'
  | 'dispute'
  | 'call-script'
  | 'guide';

export type CaseStatus = 'needs_clarification' | 'in_dispute' | 'resolved' | 'archived';

export interface LineItem {
  id: string;
  cpt_code: string;
  description: string;
  description_es: string;
  quantity: number;
  hospital_amount: number;
  benchmark_allowed: number;
  status: 'clean' | 'flagged' | 'duplicate' | 'unbundled';
  flag_reason?: string;
  flag_reason_es?: string;
}

export interface Finding {
  id: string;
  title: string;
  title_es: string;
  severity: 'high' | 'medium' | 'info';
  category: 'duplicate_charge' | 'balance_discrepancy' | 'benchmark_outlier' | 'unbundled_code';
  cpt_code?: string;
  summary: string;
  summary_es: string;
  explanation: string;
  explanation_es: string;
  evidence_quote: string;
  comparison_basis: string;
  comparison_basis_es: string;
  question_for_billing: string;
  question_for_billing_es: string;
  statutory_rule?: string;
  statutory_rule_es?: string;
  potential_savings: number;
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: 'bill' | 'eob' | 'policy';
  uploadDate: string;
  size: string;
  previewUrl?: string;
}

export interface MedicalCase {
  id: string;
  patient_name: string;
  provider_name: string;
  facility_type: string;
  service_date: string;
  statement_date: string;
  account_number: string;
  status: CaseStatus;
  documents: UploadedDocument[];
  
  // Financial Reconciliation
  total_billed: number;
  insurer_adjustments: number;
  insurer_paid: number;
  patient_paid: number;
  statement_balance: number;
  eob_responsibility: number;
  derived_remaining: number;
  discrepancy_amount: number;
  
  // Follow-up
  follow_up_date?: string;
  notes?: string;

  // Analysis Breakdown
  line_items: LineItem[];
  findings: Finding[];

  // Generated Deliverables
  dispute_letter_recipient: 'billing' | 'insurer';
  dispute_letter_draft: string;
  dispute_letter_draft_es: string;
  call_script: string;
  call_script_es: string;
  audio_summary_script: string;
  audio_summary_script_es: string;
}

export interface GlossaryTerm {
  term: string;
  term_es: string;
  category: 'insurance' | 'billing' | 'rights';
  definition: string;
  definition_es: string;
  example: string;
  example_es: string;
}
