import type { ClaimTracker } from '../domain/types';
import { backendConfigured, recordClaim, updateClaim } from './backend';
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
      return code && description && line.billedCents > 0 ? [{ code, description, amount: line.billedCents / 100 }] : [];
    });
    if (!items.length) return undefined;
    const claim = await recordClaim({
      items,
      provider_name: billCase.provider || undefined,
      service_date: billCase.serviceDate || undefined,
      total_billed: billCase.financials.billedCents / 100,
      analysis_audit_id: billCase.extraction?.auditId,
    });
    return claim.audit_id;
  },
  async update(claimId, change) {
    if (backendConfigured()) await updateClaim(claimId, change);
  },
};
