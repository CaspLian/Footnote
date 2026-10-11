import type { BillCase } from '@/domain';
import { formatDate } from '@/domain';
import { useFootnoteStore } from '@/store';
import { DateField } from './date-field';
import { Button } from './ui';
export function CaseReminder({ billCase, compact = false, title }: { billCase: BillCase; compact?: boolean; title?: string }) {
  return <DateField label="Reminder date" value={billCase.followUpDate ?? ''} sheetTitle="Choose your follow-up" confirmLabel="Save reminder" help={`For ${billCase.provider || 'this bill'}. This is your reminder, not a legal deadline.`} onChange={date => useFootnoteStore.getState().setFollowUp(billCase.id, date)} trigger={open => <Button compact={compact} variant={compact ? 'link' : 'quiet'} icon="calendar" title={title ?? (billCase.followUpDate ? `Follow-up · ${formatDate(billCase.followUpDate, 'en')}` : 'Set follow-up date')} onPress={open} />} />;
}
