import type { BenchmarkService, DocumentService } from '../domain/types';
import { backendConfigured, lookupBenchmark, type BackendBenchmark } from './backend';
import { comparisonFor, normalizeCode, reviewFindings } from './backend-mapping';
import { benchmarkService as localBenchmarks, documentService as localDocuments } from './local-services';

/**
 * With EXPO_PUBLIC_API_URL set, imported and manually entered cases are reviewed with the backend's Medicare rates
 * and Gemini's notes. The synthetic sample, and every case when no backend is set, keep the local review.
 */
export const documentService: DocumentService = {
  async processBill(billCase) {
    const local = await localDocuments.processBill(billCase); // validates the entries and writes the local summary
    if (billCase.source === 'sample' || !backendConfigured()) return local;
    const codes = [...new Set(billCase.lineItems.map(line => normalizeCode(line.code)).filter((code): code is string => !!code))];
    const benchmarks = new Map<string, BackendBenchmark>();
    // A backend that cannot be reached fails the review, so the processing screen offers to try again.
    await Promise.all(codes.map(async code => { benchmarks.set(code, await lookupBenchmark(code)); }));
    const summary = billCase.analysis?.summary ? { en: billCase.analysis.summary, es: billCase.analysis.summary } : local.summary;
    return { mode: local.mode, findings: reviewFindings(billCase, benchmarks, new Date().toISOString()), summary };
  },
};

export const benchmarkService: BenchmarkService = {
  async lookup(line) {
    const local = await localBenchmarks.lookup(line);
    const code = normalizeCode(line.code);
    if (local || !backendConfigured() || !code) return local;
    return comparisonFor(line, await lookupBenchmark(code), new Date().toISOString());
  },
};
