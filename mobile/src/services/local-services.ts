import { createSampleCase, sampleBalanceEvidence, sampleEobEvidence, SAMPLE_DOCUMENT_IDS } from '../domain/fixtures';
import { expectedRemaining, formatDate, formatMoney } from '../domain/money';
import { getCaseSummary, validateCase } from '../domain/review';
import type { BenchmarkService, BillCase, DocumentService, DraftKind, DraftService, Finding, Language, LocalizedText } from '../domain/types';

const localized = (en: string, es: string): LocalizedText => ({ en, es });

function hasOriginalSampleSources(billCase: BillCase): boolean {
  return billCase.source === 'sample' && Object.entries(SAMPLE_DOCUMENT_IDS).every(([kind, id]) =>
    billCase.attachments.some(attachment => attachment.id === id && attachment.kind === kind && attachment.origin === 'sample'));
}

export function sampleEntriesChanged(billCase: BillCase): boolean {
  const original = createSampleCase();
  return Object.entries(original.financials).some(([key, value]) => billCase.financials[key as keyof typeof original.financials] !== value)
    || JSON.stringify(billCase.lineItems.map(({ id, code, units, billedCents }) => ({ id, code, units, billedCents })))
      !== JSON.stringify(original.lineItems.map(({ id, code, units, billedCents }) => ({ id, code, units, billedCents })));
}

export function buildSampleFindings(billCase: BillCase): Finding[] {
  if (!hasOriginalSampleSources(billCase)) return [];
  const findings: Finding[] = [];
  const original = createSampleCase();
  const duplicateLines = billCase.lineItems.filter(line => line.code === '80053' && line.date === billCase.serviceDate);
  if (duplicateLines.length > 1) {
    findings.push({
      id: 'repeated-laboratory-line', title: localized('This laboratory line appears twice', 'Esta línea de laboratorio aparece dos veces'),
      explanation: localized(
        'The original bill lists two metabolic-panel entries on the same service date, while the EOB lists one unit. Both entries might describe separate services; ask the billing office to confirm.',
        'La factura original muestra dos líneas de panel metabólico en la misma fecha, mientras que la EOB indica una unidad. Podrían ser servicios distintos; pide a facturación que lo confirme.'),
      question: localized('Do both CPT 80053 entries represent separate tests? Please explain the units and reconcile them with the EOB.', '¿Las dos líneas del código 80053 corresponden a pruebas distintas? Por favor, expliquen las unidades y concílienlas con la EOB.'),
      label: 'needs_clarification', evidence: [...original.lineItems.filter(line => line.code === '80053').map(line => line.evidence), sampleEobEvidence()],
      action: 'billing_correction',
    });
  }
  const derived = expectedRemaining(billCase.financials);
  if (derived !== undefined && billCase.financials.remainingCents !== undefined && derived !== billCase.financials.remainingCents) {
    const entered = sampleEntriesChanged(billCase);
    const statementEn = formatMoney(billCase.financials.remainingCents, 'en');
    const statementEs = formatMoney(billCase.financials.remainingCents, 'es');
    const expectedEn = formatMoney(derived, 'en');
    const expectedEs = formatMoney(derived, 'es');
    findings.push({
      id: 'balance-reconciliation', title: localized('The patient balances do not match', 'Los saldos del paciente no coinciden'),
      explanation: localized(
        `${entered ? 'Using your confirmed entries, the' : 'The'} statement asks for ${statementEn}. EOB responsibility minus the recorded patient payment leaves ${expectedEn}. The original document excerpts are shown below. Ask which adjustments or payments explain the difference.`,
        `${entered ? 'Según los datos que confirmaste, el' : 'El'} estado de cuenta solicita ${statementEs}. La responsabilidad de la EOB menos el pago registrado deja ${expectedEs}. Abajo se muestran extractos de los documentos originales. Pregunta qué ajustes o pagos explican la diferencia.`),
      question: localized('Has this statement applied the latest EOB adjustment and my recorded payment? Please send a reconciled, itemized balance.', '¿Este estado de cuenta incluye el último ajuste de la EOB y mi pago registrado? Por favor, envíen un saldo detallado y conciliado.'),
      label: 'needs_clarification', evidence: sampleBalanceEvidence(), action: 'billing_correction',
    });
  }
  return findings;
}

export const documentService: DocumentService = {
  async processBill(billCase) {
    const issues = validateCase(billCase);
    if (issues.length) throw new Error('verification_required');
    // Only our explicitly marked paired fixture receives local seeded findings.
    const mode = hasOriginalSampleSources(billCase) ? 'synthetic' : 'manual';
    const reviewed = { ...billCase, reviewMode: mode as 'synthetic' | 'manual', entriesEdited: billCase.source === 'sample' && sampleEntriesChanged(billCase) };
    return {
      mode, findings: mode === 'synthetic' ? buildSampleFindings(reviewed) : [],
      summary: localized(getCaseSummary(reviewed, 'en'), getCaseSummary(reviewed, 'es')),
    };
  },
};

export const benchmarkService: BenchmarkService = {
  async lookup() {
    // No fabricated regional benchmark. Connect a sourced comparison adapter later.
    return null;
  },
};

export function buildDraft(billCase: BillCase, kind: DraftKind, language: Language): string {
  const provider = billCase.provider || (language === 'en' ? '[Provider name]' : '[Nombre del proveedor]');
  const date = formatDate(billCase.serviceDate, language);
  const f = billCase.financials;
  const balance = formatMoney(f.remainingCents, language);
  const responsibility = formatMoney(f.eobResponsibilityCents, language);
  const payment = formatMoney(f.patientPaidCents, language);
  const derived = expectedRemaining(f);
  if (kind === 'insurer_appeal') {
    return language === 'en'
      ? `To my health plan's appeals team,\n\nI am requesting a review of the decision on my claim for care at ${provider} on ${date}.\n\nClaim number: [Add claim number]\nDecision being appealed: [Describe the denied benefit or payment from your notice]\nReason for review: [Explain why you disagree and list supporting documents]\n\nPlease review the claim and provide a written explanation of the coverage decision and the applicable plan terms. [List the supporting documents you will attach.]\n\nPlease tell me if additional documentation is needed.\n\n[Your name]\n[Your contact details]\n\nBefore sending: replace every bracketed field and confirm the appeal instructions and deadline on your decision notice. The synthetic sample contains no denial.`
      : `Al equipo de apelaciones de mi plan de salud:\n\nSolicito una revisión de la decisión sobre mi reclamación por la atención en ${provider} el ${date}.\n\nNúmero de reclamación: [Agrega el número]\nDecisión que apelo: [Describe el beneficio o pago denegado en tu aviso]\nMotivo de revisión: [Explica por qué no estás de acuerdo e indica los documentos de respaldo]\n\nPor favor, revisen la reclamación y envíen una explicación escrita de la decisión de cobertura y de las condiciones aplicables del plan. Adjunto la EOB y los documentos relevantes.\n\nIndíquenme si necesitan documentación adicional.\n\n[Tu nombre]\n[Tu información de contacto]\n\nAntes de enviar: reemplaza todos los campos entre corchetes y confirma las instrucciones y el plazo de tu aviso de decisión. El ejemplo ficticio no contiene una denegación.`;
  }
  const questions = billCase.findings.filter(finding => finding.action === 'billing_correction').map(finding => `• ${finding.question[language]}`).join('\n');
  const reconciliationEn = derived === undefined
    ? 'I would appreciate an itemized statement showing the services, adjustments, insurer payments and payments already received.'
    : `The EOB assigns ${responsibility} to me. After my recorded ${payment} payment, I calculate ${formatMoney(derived, language)} remaining. Please explain any difference from the statement.`;
  const reconciliationEs = derived === undefined
    ? 'Agradecería un estado de cuenta detallado con los servicios, ajustes, pagos de la aseguradora y pagos ya recibidos.'
    : `La EOB me asigna ${responsibility}. Después de mi pago registrado de ${payment}, calculo un saldo de ${formatMoney(derived, language)}. Por favor, expliquen cualquier diferencia con el estado de cuenta.`;
  return language === 'en'
    ? `To ${provider}'s billing team,\n\nI am requesting clarification of the billing details for care on ${date}. ${f.remainingCents === undefined ? 'Please confirm the current patient balance.' : `The statement shows a remaining balance of ${balance}.`}\n\n${reconciliationEn}\n\n${questions || 'Please confirm that the service details and all applicable adjustments are accurate.'}\n\nPlease provide a reconciled, itemized statement and let me know whether any correction is needed. I am asking for clarification before deciding on a next step.\n\nThank you,\n[Your name]\n[Account number]\n[Your contact details]`
    : `Al equipo de facturación de ${provider}:\n\nSolicito una aclaración de mi estado de cuenta por la atención del ${date}. Indica un saldo de ${balance}.\n\n${reconciliationEs}\n\n${questions || 'Por favor, confirmen que los detalles de los servicios y todos los ajustes aplicables son correctos.'}\n\nEnvíen un estado de cuenta detallado y conciliado e indiquen si hace falta alguna corrección. Solicito una aclaración antes de decidir el siguiente paso.\n\nGracias,\n[Tu nombre]\n[Número de cuenta]\n[Tu información de contacto]`;
}

export function getCallScript(billCase: BillCase, language: Language): string {
  const intro = language === 'en'
    ? `Hello, I'm calling about my statement from ${billCase.provider} for ${formatDate(billCase.serviceDate, language)}. Could you help me understand the charges and explain any adjustments or payments?`
    : `Hola, llamo por mi estado de cuenta de ${billCase.provider} del ${formatDate(billCase.serviceDate, language)}. ¿Podrían ayudarme a entender los cargos y explicar los ajustes o pagos?`;
  const questions = billCase.findings.map(finding => finding.question[language]);
  const closing = language === 'en'
    ? 'Please give me a reference number for this conversation and send an updated itemized statement. What is the next step and when should I follow up?'
    : 'Por favor, denme un número de referencia de esta conversación y envíen un estado de cuenta detallado actualizado. ¿Cuál es el siguiente paso y cuándo debo dar seguimiento?';
  return [intro, ...questions, closing].join('\n\n');
}

export const draftService: DraftService = { async prepare(billCase, kind, language) { return buildDraft(billCase, kind, language); } };
