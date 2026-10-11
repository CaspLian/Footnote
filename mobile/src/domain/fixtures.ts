import type { BillCase, DocumentAttachment, Evidence, LocalizedText } from './types';

export const SAMPLE_CASE_ID = 'northline-sample';
export const SAMPLE_SERVICE_DATE = '2026-09-18';
export const SAMPLE_DOCUMENT_IDS = { bill: 'northline-bill', eob: 'northline-eob' } as const;
const text = (en: string, es: string): LocalizedText => ({ en, es });
const evidence = (attachmentId: string, enLabel: string, esLabel: string, en: string, es: string): Evidence => ({
  attachmentId, page: 1, label: text(enLabel, esLabel), excerpt: text(en, es),
});

export function createSampleCase(id = SAMPLE_CASE_ID, at = new Date().toISOString()): BillCase {
  const attachments: DocumentAttachment[] = [
    { id: SAMPLE_DOCUMENT_IDS.bill, uri: 'sample://northline-bill', name: 'Northline — itemized bill.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'sample', importedAt: at, pageCount: 1 },
    { id: SAMPLE_DOCUMENT_IDS.eob, uri: 'sample://northline-eob', name: 'Northline — explanation of benefits.pdf', mimeType: 'application/pdf', kind: 'eob', origin: 'sample', importedAt: at, pageCount: 1 },
  ];
  return {
    id, provider: 'Northline Medical Center', serviceDate: SAMPLE_SERVICE_DATE,
    description: text('Emergency visit', 'Visita a urgencias'), status: 'needs_details', source: 'sample',
    attachments,
    lineItems: [
      { id: 'emergency-visit', description: text('Emergency department visit', 'Visita al departamento de urgencias'), code: '99284', date: SAMPLE_SERVICE_DATE, units: 1, billedCents: 167000, evidence: evidence(SAMPLE_DOCUMENT_IDS.bill, 'Bill · row 1', 'Factura · línea 1', '09/18/2026 · 99284 · Emergency visit · 1 · $1,670.00', '18/09/2026 · 99284 · Visita a urgencias · 1 · $1,670.00') },
      { id: 'ct-scan', description: text('CT scan', 'Tomografía computarizada'), code: '74176', date: SAMPLE_SERVICE_DATE, units: 1, billedCents: 50000, evidence: evidence(SAMPLE_DOCUMENT_IDS.bill, 'Bill · row 2', 'Factura · línea 2', '09/18/2026 · 74176 · CT scan · 1 · $500.00', '18/09/2026 · 74176 · Tomografía · 1 · $500.00') },
      { id: 'metabolic-1', description: text('Comprehensive metabolic panel', 'Panel metabólico completo'), code: '80053', date: SAMPLE_SERVICE_DATE, units: 1, billedCents: 25000, evidence: evidence(SAMPLE_DOCUMENT_IDS.bill, 'Bill · row 3', 'Factura · línea 3', '09/18/2026 · 80053 · Metabolic panel · 1 · $250.00', '18/09/2026 · 80053 · Panel metabólico · 1 · $250.00') },
      { id: 'metabolic-2', description: text('Comprehensive metabolic panel', 'Panel metabólico completo'), code: '80053', date: SAMPLE_SERVICE_DATE, units: 1, billedCents: 25000, evidence: evidence(SAMPLE_DOCUMENT_IDS.bill, 'Bill · row 4', 'Factura · línea 4', '09/18/2026 · 80053 · Metabolic panel · 1 · $250.00', '18/09/2026 · 80053 · Panel metabólico · 1 · $250.00') },
    ],
    financials: {
      billedCents: 267000, adjustmentCents: 144000, postAdjustmentCents: 123000,
      allowedCents: 98000, insurerPaidCents: 68600, patientResponsibilityCents: 29400,
      patientPaidCents: 5000, remainingCents: 49400, eobBilledCents: 242000,
      eobResponsibilityCents: 29400, deductibleCents: 0, coinsuranceCents: 29400, copaymentCents: 0,
    },
    findings: [], createdAt: at, updatedAt: at,
  };
}

export function createManualCase(attachment?: DocumentAttachment, id = `case-${Date.now()}`, at = new Date().toISOString()): BillCase {
  return {
    id, provider: '', serviceDate: '', description: text('Imported document', 'Documento importado'),
    status: 'needs_details', source: 'manual', attachments: attachment ? [attachment] : [], lineItems: [], findings: [],
    financials: {},
    createdAt: at, updatedAt: at,
  };
}

export function sampleEobEvidence(): Evidence {
  return evidence(SAMPLE_DOCUMENT_IDS.eob, 'EOB · service detail', 'EOB · detalle del servicio',
    '80053 · Metabolic panel · 1 unit · $250.00 billed', '80053 · Panel metabólico · 1 unidad · $250.00 facturados');
}

export function sampleBalanceEvidence(): Evidence[] {
  return [
    evidence(SAMPLE_DOCUMENT_IDS.bill, 'Bill · account summary', 'Factura · resumen de la cuenta',
      'Statement balance $494.00 · Patient payment received $50.00', 'Saldo del estado de cuenta $494.00 · Pago del paciente recibido $50.00'),
    evidence(SAMPLE_DOCUMENT_IDS.eob, 'EOB · patient responsibility', 'EOB · responsabilidad del paciente',
      'Allowed amount $980.00 · Plan paid $686.00 · Patient responsibility $294.00', 'Importe permitido $980.00 · Pago del plan $686.00 · Responsabilidad del paciente $294.00'),
  ];
}
