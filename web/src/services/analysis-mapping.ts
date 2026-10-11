import type { Finding, Language, LineItem, MedicalCase, UploadedDocument } from '../types';
import type { AnalyzeResponse, BackendLineItem, PriceCheck } from './backend';

/**
 * A case made from a real analysis: the app's MedicalCase, plus what the backend calls need.
 *
 * What the backend does not produce stays empty or zero instead of being made up: potential savings, a
 * "discrepancy" (that needs a bill and its EOB compared), statutes, insurer payments. Findings come only from the
 * Medicare price check, and they are a reason to ask questions, never proof that a charge is wrong.
 */
export interface ConnectedCase extends MedicalCase {
  /** For POST /api/v1/voice/speak and GET /api/v1/audits/{id}. Null when Tiger Data did not save the analysis. */
  audit_id: string | null;
  /** The locale the analysis is written in, e.g. "es-MX". Gemini writes in one language: the `_es` fields of its
   *  text hold the same words as the English ones. */
  analysis_language: string;
  plain_summary: string;
  questions_to_ask: string[];
  /** One per line item, in order, as the backend returned them. */
  price_checks: PriceCheck[];
}

/** The web app's two languages, as the locales the backend takes (it offers 42: GET /api/v1/languages). */
export const LOCALE_FOR: Record<Language, string> = { en: 'en-US', es: 'es-MX' };

const ABOVE: PriceCheck['flag'][] = ['above_typical', 'far_above_typical'];

const DOCUMENT_LABEL: Record<string, [string, string]> = {
  hospital_bill: ['Hospital bill', 'Factura del hospital'],
  eob: ['Explanation of Benefits', 'Explicación de beneficios'],
  insurance_policy: ['Insurance policy', 'Póliza de seguro'],
  pharmacy_receipt: ['Pharmacy receipt', 'Recibo de farmacia'],
};

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function times(value: number): string {
  return value >= 100 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(Number(value.toFixed(1)));
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** "2026-09-18" -> "Sep 18, 2026", the format of the app's sample cases; "" when missing or not a date. */
export function displayDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return match ? shortDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : '';
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function lineName(item: BackendLineItem | undefined, index: number): string {
  const name = (item?.plain_description.trim() || item?.original_description.trim() || '').replace(/\.$/, '');
  return name || `Line ${index + 1}`;
}

function findingFor(check: PriceCheck, item: BackendLineItem | undefined, index: number): Finding {
  const far = check.flag === 'far_above_typical';
  const name = lineName(item, check.line_index);
  const ratio = times(check.times_medicare ?? 0);
  const code = check.cpt_code ?? '';
  const billed = check.billed_amount ?? 0;
  const rate = check.medicare_rate ?? 0;
  return {
    id: `finding-${index + 1}`,
    title: `${name}: billed about ${ratio}× Medicare's national rate`,
    title_es: `${name}: facturado a cerca de ${ratio} veces la tarifa nacional de Medicare`,
    severity: far ? 'high' : 'medium',
    category: 'benchmark_outlier',
    cpt_code: code || undefined,
    summary: `${far ? 'Far above' : 'Higher than'} the usual range for this service. A reason to ask questions, not proof of an error.`,
    summary_es: `${far ? 'Muy por encima' : 'Por encima'} del rango habitual para este servicio. Es un motivo para preguntar, no una prueba de un error.`,
    explanation: `The bill lists ${name} at ${money(billed)}. Medicare's national rate for code ${code} is ${money(rate)}, so the `
      + `charge is about ${ratio} times that rate. ${check.note}`.trim(),
    explanation_es: `La factura incluye ${name} por ${money(billed)}. La tarifa nacional de Medicare para el código ${code} es `
      + `${money(rate)}, así que el cargo es cerca de ${ratio} veces esa tarifa. Las tarifas de Medicare son una referencia: `
      + 'su seguro puede pagar otras.',
    evidence_quote: `${item?.original_description.trim() || name}: ${money(billed)} billed | Medicare national rate: ${money(rate)} (code ${code})`,
    comparison_basis: "Medicare's national rate (CMS fee schedule), not your insurer's price",
    comparison_basis_es: 'Tarifa nacional de Medicare (CMS), no el precio de su seguro',
    question_for_billing: `Can you explain the charge for ${name} (code ${code}) and send me an itemized statement?`,
    question_for_billing_es: `¿Pueden explicarme el cargo de ${name} (código ${code}) y enviarme una factura detallada?`,
    potential_savings: 0,
  };
}

function lineItemFor(item: BackendLineItem, index: number, check: PriceCheck | undefined): LineItem {
  const priced = check && ABOVE.includes(check.flag) && check.times_medicare != null;
  const priceNote = priced ? `Billed about ${times(check.times_medicare!)}× Medicare's national rate.` : '';
  const priceNoteEs = priced ? `Facturado a cerca de ${times(check.times_medicare!)} veces la tarifa nacional de Medicare.` : '';
  const issues = item.possible_issues.filter(issue => issue.trim());
  const flagged = priced || issues.length > 0;
  return {
    id: `line-${index + 1}`,
    cpt_code: item.cpt_code ?? '',
    description: lineName(item, index),
    description_es: lineName(item, index),
    quantity: 1, // the analysis does not read units yet
    hospital_amount: item.billed_amount ?? 0,
    benchmark_allowed: check?.medicare_rate ?? 0,
    status: flagged ? 'flagged' : 'clean',
    ...(flagged
      ? { flag_reason: [...issues, priceNote].filter(Boolean).join(' '), flag_reason_es: [...issues, priceNoteEs].filter(Boolean).join(' ') }
      : {}),
  };
}

function letter(language: Language, provider: string, serviceDate: string, findings: Finding[], items: LineItem[]): string {
  const es = language === 'es';
  const asked = findings.length
    ? findings.map(f => `- ${es ? f.title_es : f.title}`)
    : items.filter(i => i.status === 'flagged').map(i => `- ${i.description}: ${money(i.hospital_amount)}`);
  if (es) {
    return [`Para: ${provider} · Departamento de facturación`, serviceDate ? `Fecha del servicio: ${serviceDate}` : '',
      '', 'ASUNTO: Solicitud de factura detallada y explicación de cargos', '', 'Estimado departamento de facturación:', '',
      'Estoy revisando mi factura. Les pido una factura detallada con el código de cada cargo'
        + (asked.length ? ', y una explicación de estos cargos:' : '.'),
      ...(asked.length ? ['', ...asked] : []), '',
      'Por favor, díganme si estos cargos son correctos. Mientras los revisan, les pido que la cuenta no se envíe a cobranza.',
      '', 'Gracias.'].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
  }
  return [`To: ${provider} · Billing Department`, serviceDate ? `Date of service: ${serviceDate}` : '', '',
    'RE: Request for an itemized statement and an explanation of charges', '', 'Dear Billing Department,', '',
    'I am reviewing my bill. Please send me an itemized statement with the code for each charge'
      + (asked.length ? ', and an explanation of these charges:' : '.'),
    ...(asked.length ? ['', ...asked] : []), '',
    'Please let me know whether these charges are correct. While you review them, I ask that the account not be sent to collections.',
    '', 'Thank you.'].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
}

function callScript(language: Language, provider: string, serviceDate: string, questions: string[], findings: Finding[]): string {
  const es = language === 'es';
  const all = [...findings.map(f => (es ? f.question_for_billing_es : f.question_for_billing)), ...questions];
  const intro = es
    ? `Hola, llamo por mi factura de ${provider}${serviceDate ? ` por los servicios del ${serviceDate}` : ''}. Tengo algunas preguntas:`
    : `Hi, I'm calling about my bill from ${provider}${serviceDate ? ` for services on ${serviceDate}` : ''}. I have a few questions:`;
  return [intro, '', ...all.map((question, i) => `${i + 1}. ${question}`)].join('\n');
}

/**
 * A MedicalCase for the app's screens, from what POST /api/v1/analyze returned for these files.
 * `language` is the app's display language, for the text written here (finding titles, the letter, the call script).
 */
export function toConnectedCase(response: AnalyzeResponse, files: { name: string; size: number }[], language: Language, today = new Date()): ConnectedCase {
  const { result } = response;
  const checks = new Map(response.price_checks.map(check => [check.line_index, check]));
  const items = result.line_items.map((item, index) => lineItemFor(item, index, checks.get(index)));
  const findings = response.price_checks
    .filter(check => ABOVE.includes(check.flag) && check.times_medicare != null)
    .sort((a, b) => Number(b.flag === 'far_above_typical') - Number(a.flag === 'far_above_typical') || (b.times_medicare ?? 0) - (a.times_medicare ?? 0))
    .map((check, index) => findingFor(check, result.line_items[check.line_index], index));
  const unknownProvider = language === 'es' ? 'Proveedor desconocido' : 'Unknown provider';
  const provider = result.provider_name?.trim() || unknownProvider;
  const serviceDate = displayDate(result.line_items.find(item => item.date_of_service)?.date_of_service);
  const totalBilled = result.total_billed ?? items.reduce((sum, item) => sum + item.hospital_amount, 0);
  const owed = result.amount_patient_owes ?? totalBilled;
  const isEob = result.document_type === 'eob';
  const label = DOCUMENT_LABEL[result.document_type] ?? ['Document', 'Documento'];
  const documentType: UploadedDocument['type'] = isEob ? 'eob' : result.document_type === 'insurance_policy' ? 'policy' : 'bill';
  const auditId = response.audit?.saved ? response.audit.audit_id : null;
  return {
    id: `case-${auditId ?? `${today.getTime()}`}`,
    patient_name: '',
    provider_name: provider,
    facility_type: language === 'es' ? label[1] : label[0],
    service_date: serviceDate,
    statement_date: '',
    account_number: '',
    status: 'needs_clarification',
    documents: files.map((file, index) => ({
      id: `doc-${index + 1}`,
      name: file.name,
      type: documentType,
      uploadDate: shortDate(today),
      size: fileSize(file.size),
    })),
    total_billed: totalBilled,
    insurer_adjustments: 0,
    insurer_paid: 0,
    patient_paid: 0,
    statement_balance: owed,
    eob_responsibility: isEob ? owed : 0,
    derived_remaining: owed,
    discrepancy_amount: 0,
    line_items: items,
    findings,
    dispute_letter_recipient: isEob ? 'insurer' : 'billing',
    dispute_letter_draft: letter('en', provider, serviceDate, findings, items),
    dispute_letter_draft_es: letter('es', provider, serviceDate, findings, items),
    call_script: callScript('en', provider, serviceDate, result.questions_to_ask, findings),
    call_script_es: callScript('es', provider, serviceDate, result.questions_to_ask, findings),
    audio_summary_script: result.spoken_summary,
    audio_summary_script_es: result.spoken_summary,
    audit_id: auditId,
    analysis_language: response.target_language,
    plain_summary: result.plain_summary,
    questions_to_ask: result.questions_to_ask,
    price_checks: response.price_checks,
  };
}
