import type { Language } from '@/domain';
import { colors } from '@/theme';

export type DraftExport = { title: string; body: string; language: Language };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

/** No remote assets or scripts are allowed in the locally generated draft. */
export function draftToHtml({ title, body, language }: DraftExport): string {
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>
    @page { margin: 40pt; } body { font-family: -apple-system, sans-serif; color: ${colors.ink}; line-height: 1.55; font-size: 11pt; }
    h1 { font-size: 19pt; line-height: 1.25; margin: 0 0 24pt; } .draft { white-space: pre-wrap; overflow-wrap: anywhere; }
    footer { color: ${colors.muted}; font-size: 8pt; border-top: 1pt solid ${colors.line}; padding-top: 12pt; margin-top: 28pt; }
  </style></head><body><h1>${escapeHtml(title)}</h1><div class="draft">${escapeHtml(body)}</div><footer>${language === 'es' ? 'Preparado en Unfold. Revisa los datos y el destinatario antes de enviarlo.' : 'Prepared in Unfold. Check the details and recipient before sending.'}</footer></body></html>`;
}
