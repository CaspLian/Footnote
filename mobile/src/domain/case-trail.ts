import type { BillCase, CaseEvent, CaseEventKind } from './types';
export const eventLabels: Record<CaseEventKind, string> = {
  imported: 'Document added', verified: 'Details verified', draft_prepared: 'Draft prepared', submitted: 'Request marked submitted', follow_up_set: 'Follow-up set', follow_up_removed: 'Follow-up removed', resolved: 'Case marked resolved', deadline_set: 'Notice deadline confirmed', deadline_removed: 'Notice deadline removed',
};
const stages = [
  { title: 'Gather your documents', detail: 'A bill, EOB or the details you entered.', event: 'imported' },
  { title: 'Confirm the details', detail: 'Check the provider, service date and amounts.', event: 'verified' },
  { title: 'Review & prepare', detail: 'Understand your questions and prepare a request.', event: 'draft_prepared' },
  { title: 'Send your request', detail: 'Send it yourself, then mark it submitted here.', event: 'submitted' },
  { title: 'Follow through', detail: 'Track your next date and record the outcome.', event: 'resolved' },
] as const;
/** Current case state governs the trail. Adding a document can require verification again. */
export function caseTrail(c: BillCase, events: CaseEvent[]) {
  const current = ({ needs_details: 1, ready: 2, action_prepared: 3, submitted: 4, resolved: 5 })[c.status];
  return stages.map((stage, index) => ({ ...stage, state: index < current ? 'complete' as const : index === current ? 'current' as const : 'upcoming' as const, at: events.filter(e => e.caseId === c.id && e.kind === stage.event).at(-1)?.at }));
}
export function caseNextAction(c: BillCase) {
  return ({ needs_details: { title: 'Verify details', route: '/verify' }, ready: { title: 'Review this bill', route: '/review' }, action_prepared: { title: 'Open your request', route: '/draft' }, submitted: { title: 'Review your submitted request', route: '/draft' }, resolved: { title: 'Update case', route: '/verify' } } as const)[c.status];
}
