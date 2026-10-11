import type { BillCase } from './types';

/** Imported evidence must be read before any amount-entry or review path opens. */
export function needsDocumentProcessing(c: BillCase): boolean {
  const imports = c.attachments.filter(a => a.origin === 'import');
  if (!imports.length) return false; // Explicit manual cases have no imported documents.
  if (!c.extraction || c.extraction.mock) return true;
  if (c.extraction.processedAttachmentIds) return imports.some(a=>!c.extraction!.processedAttachmentIds!.includes(a.id));
  const kinds = c.extraction.documentKinds;
  // Legacy analyses predate per-file classification; changing the files clears extraction.
  return !!kinds && Object.keys(kinds).length > 0 && imports.some(a => !kinds[a.id]);
}
