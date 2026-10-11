// The two agent client tools can highlight existing Review findings, without navigating or changing bill data.
import type { AgentContext } from './voice-agent';
import type { AgentLine } from './voice-agent-session';

export const CLIENT_TOOL_NAMES = ['show_line_item', 'show_price_check'] as const;
export type AgentScreenRequest = { kind: 'line' | 'price'; lineNumber: number };
export type AgentHighlight = { caseId: string; findingId: string; lineNumber: number; lineName?: string; at: number };

// Extraction numbers original bill lines from 1; Review keeps these IDs after verification.
export const lineIdForNumber = (lineNumber: number) => `gemini-line-${lineNumber}`;
export function findingIdForLine(findings: { id: string }[], request: AgentScreenRequest): string | undefined {
  const line = lineIdForNumber(request.lineNumber);
  const ids = request.kind === 'price' ? [`price-${line}`] : [`note-${line}`, `price-${line}`];
  return ids.find(id => findings.some(f => f.id === id));
}

/** The agent's line_number counts from 1, as the bill details number the lines. Anything else is refused. */
export function parseLineNumber(params: unknown): number | undefined {
  const value = (params as { line_number?: unknown } | null)?.line_number;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 999 ? value : undefined;
}

// The agent was told a doctor-only Medicare rate "can't show whether the charge is high" (revision 2, section 3), and
// was given no rate for lines it could not compare. Never light up a "N times Medicare" card for those lines.
const NO_PRICE_CARD = new Set(['doctor_part_only', 'not_compared']);

let current: AgentHighlight | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const highlightStore = {
  get: () => current,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set(next: AgentHighlight | undefined) { current = next; emit(); },
};
export function clearAgentHighlight() { if (current) highlightStore.set(undefined); }

/** Handlers for startSession's clientTools. They answer at once (expects_response: false: the agent never reads the result). */
export function agentToolHandlers(context: AgentContext, lines: AgentLine[], now: () => number = Date.now): Record<(typeof CLIENT_TOOL_NAMES)[number], (params: unknown) => string> {
  const show = (kind: AgentScreenRequest['kind']) => (params: unknown) => {
    const lineNumber = parseLineNumber(params);
    const line = lineNumber ? lines.find(l => l.number === lineNumber) : undefined;
    if (!lineNumber || !line) return `There is no line ${lineNumber ?? '?'} on this bill.`;
    if (!line.inContext) return `Line ${lineNumber} is not available in this conversation.`;
    const priceHidden = !!line?.label && NO_PRICE_CARD.has(line.label);
    const findings = (context.case?.findings ?? []).filter(f => !(priceHidden && f.id.startsWith('price-')));
    const findingId = context.case ? findingIdForLine(findings, { kind, lineNumber }) : undefined;
    if (!context.case || !findingId) return `Line ${lineNumber} has no card on this screen.`;
    highlightStore.set({ caseId: context.case.id, findingId, lineNumber, lineName: line?.name, at: now() });
    return 'Shown on screen.';
  };
  return { show_line_item: show('line'), show_price_check: show('price') };
}
