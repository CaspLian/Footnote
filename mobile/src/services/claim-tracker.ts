import { isISODate } from '../domain/money';
import type { ClaimTracker } from '../domain/types';
import { backendConfigured, claimDeadlines, recordClaim, updateClaim } from './backend';
import { normalizeCode } from './backend-mapping';

/**
 * Keeps each confirmed case's claim in Tiger Data in step with the app: recorded on the first confirmation, then the
 * review, a submitted request, a notice date and the resolution. Tiger Data needs a code, a description and an
 * amount on every recorded line, so lines without them are left out and the bill's total is sent separately.
 * Without a backend (EXPO_PUBLIC_API_URL unset) nothing is sent.
 */
export const claimTracker: ClaimTracker = {
  async record(billCase) {
    if (!backendConfigured()) return undefined;
    const items = billCase.lineItems.flatMap(line => {
      const code = normalizeCode(line.code);
      const description = (line.description.en || line.evidence.excerpt.en).trim();
      return !line.amountMissing && code && description && line.billedCents > 0 ? [{ code, description, amount: line.billedCents / 100 }] : [];
    });
    if (!items.length) return undefined;
    const claim = await recordClaim({
      items,
      provider_name: billCase.provider || undefined,
      service_date: billCase.serviceDate || undefined,
      // The due date Gemini read from the bill. Tiger Data estimates the deadlines from the bill's dates.
      payment_due_date: billCase.extraction?.dueDate && isISODate(billCase.extraction.dueDate) ? billCase.extraction.dueDate : undefined,
      total_billed: billCase.financials.billedCents === undefined ? undefined : billCase.financials.billedCents / 100,
      analysis_audit_id: billCase.extraction?.auditId,
    });
    return claim.audit_id;
  },
  async update(claimId, change) {
    if (backendConfigured()) await updateClaim(claimId, change);
  },
  async deadlines(claimId) {
    return backendConfigured() ? claimDeadlines(claimId) : undefined;
  },
};
