import type { DocumentAttachment, DocumentKind } from '@/domain';
import type { ImportPreparation, ImportResult, ImportSource } from './documents';
export type ImportSnapshot = { phase: 'idle'|'choosing'|'preparing'; filename?: string; error?: string; denied?: boolean };
export interface ImportAdapter {
  pick(source: ImportSource, kind: DocumentKind, onPreparing: ImportPreparation): Promise<ImportResult>;
  paint(): Promise<void>;
  commit(attachment: DocumentAttachment, caseId?: string, additionalAttachments?: DocumentAttachment[]): string;
  discard(attachment: DocumentAttachment): Promise<void>;
  advance(caseId: string): void;
}
/** One import at a time. Cancelled or abandoned work never advances or creates a case. */
export class ImportController {
  private generation = 0;
  private snapshot: ImportSnapshot = { phase: 'idle' };
  private listeners = new Set<() => void>();
  constructor(private readonly adapter: ImportAdapter) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(snapshot: ImportSnapshot) { this.snapshot = snapshot; this.listeners.forEach(l => l()); }
  cancel = () => { this.generation++; this.update({ phase: 'idle' }); };
  async run(source: ImportSource, kind: DocumentKind = 'auto', caseId?: string) {
    if (this.snapshot.phase !== 'idle') return;
    const generation = ++this.generation;
    this.update({ phase: 'choosing' });
    try {
      const result = await this.adapter.pick(source, kind, async file => {
        if (generation !== this.generation) return;
        this.update({ phase: 'preparing', filename: file.name });
        await this.adapter.paint();
      });
      if (generation !== this.generation) { if (result.status === 'success') await Promise.all([result.attachment, ...(result.additionalAttachments ?? [])].map(a => this.adapter.discard(a))); return; }
      if (result.status === 'success') {
        let id: string;
        try { id = this.adapter.commit(result.attachment, caseId, result.additionalAttachments); }
        catch (error) { await Promise.all([result.attachment, ...(result.additionalAttachments ?? [])].map(a => this.adapter.discard(a))); throw error; }
        this.update({ phase: 'idle' });
        this.adapter.advance(id);
      } else if (result.status === 'permission-denied') this.update({ phase: 'idle', denied: true, error: 'Camera access is off. Open device settings or choose a photo or PDF instead.' });
      else if (result.status === 'error') this.update({ phase: 'idle', error: result.message.en });
      else this.update({ phase: 'idle' });
    } catch {
      if (generation === this.generation) this.update({ phase: 'idle', error: 'The document could not be added. Try another photo or PDF.' });
    }
  }
}
