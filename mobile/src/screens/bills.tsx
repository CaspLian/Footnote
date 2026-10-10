import { useState } from 'react';
import { router } from 'expo-router';
import { useUnfoldStore } from '@/store';
import { Button, Group, Screen, Txt } from '@/components/ui';
import { SearchTransition } from '@/components/search-transition';
import { SearchControl } from '@/components/search-control';
import { CaseRow, EmptyBills } from './shared';
import { selectBills } from '@/domain/bill-list';
import { space } from '@/theme';
export function Bills() {
  const cases = useUnfoldStore(s => s.cases);
  const profiles = useUnfoldStore(s => s.profiles);
  const prefs = useUnfoldStore(s => s.preferences);
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<'all'|'open'|'resolved'>('all');
  const searching = focused || !!search.trim();
  const filtered = selectBills(cases, profiles, { ...prefs, showResolved: searching || filter === 'resolved' || prefs.showResolved }, search).filter(c => filter === 'all' || (filter === 'resolved' ? c.status === 'resolved' : c.status !== 'resolved'));
  return <Screen softenSearchEdge scrollEdgeHeight={32} footerSafeArea={false} testID="bills" searchMode={searching} footer={!searching && cases.length ? <Button title="Add documents" icon="plus" onPress={() => router.navigate('/intake')} /> : undefined}>
    {!searching ? <SearchTransition reveal><Group gap={space.lg}><Txt variant="display">Every bill,{'\n'}in one place.</Txt><Txt muted>Original documents and next steps, together.</Txt></Group></SearchTransition> : null}
    <SearchControl key="search" softenBelow label="Search bills" placeholder="Provider or family member" value={search} onChange={setSearch} active={searching} onActiveChange={setFocused} />
    <SearchTransition><Group style={{flexDirection:'row', flexWrap:'wrap', gap:space.sm}}>{([['all','All'],['open','Open'],['resolved','Resolved']] as const).map(([value,title])=><Button key={value} compact title={title} variant={filter===value?'quiet':'secondary'} onPress={()=>setFilter(value)}/>)}</Group></SearchTransition>
    <SearchTransition>{cases.length || searching ? <Group gap={space.screen}><Txt variant="caption" muted>{filtered.length} {filtered.length === 1 ? 'bill' : 'bills'}{searching ? '' : ` · ${prefs.billSort === 'recent' ? 'Most recent first' : prefs.billSort === 'balance' ? 'Highest balance first' : 'Next follow-up first'}`}</Txt>{filtered.length ? filtered.map(c => <CaseRow key={c.id} billCase={c} />) : <Group gap={space.lg}><Txt muted>{search ? `No bills match “${search}”. Try a provider or family name.` : searching ? 'No bills match this filter.' : 'No open bills. Try a different filter.'}</Txt>{search ? <Button title="Clear search" variant="secondary" onPress={() => setSearch('')} /> : null}</Group>}</Group> : <EmptyBills />}</SearchTransition>
  </Screen>;
}
