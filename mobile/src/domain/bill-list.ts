import type { BillCase, FamilyProfile } from './types';
import type { AppPreferences } from './preferences';
export function selectBills(cases: BillCase[], profiles: FamilyProfile[], prefs: Pick<AppPreferences, 'showResolved' | 'billSort'>, search: string) {
  const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const needle = normalize(search.trim());
  return cases.filter(c => (prefs.showResolved || c.status !== 'resolved') && normalize(`${c.provider} ${c.serviceDate} ${profiles.find(p => p.id === c.profileId)?.firstName ?? ''}`).includes(needle)).sort((a, b) => {
    if (prefs.billSort === 'balance') return (b.financials.remainingCents ?? -1) - (a.financials.remainingCents ?? -1) || b.updatedAt.localeCompare(a.updatedAt);
    if (prefs.billSort === 'follow_up') return (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999') || b.updatedAt.localeCompare(a.updatedAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
