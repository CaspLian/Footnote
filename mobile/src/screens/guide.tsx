import { useState } from 'react';
import { useTranslation } from '@/localization/use-translation';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { glossary, searchGlossary, type GlossaryTerm } from '@/domain';
import { useFootnoteStore } from '@/store';
import { Button, Divider, Group, Screen, Section, Txt, useLanguage } from '@/components/ui';
import { SearchTransition } from '@/components/search-transition';
import { SearchControl } from '@/components/search-control';
import { Icon } from '@/components/icon';
import { radius, space, useTheme } from '@/theme';
function TermRow({ term }: { term: GlossaryTerm }) {
  const { colors } = useTheme();
  const saved = useFootnoteStore(s => s.savedTermIds.includes(term.id));
  return <Pressable accessibilityRole="button" accessibilityLabel={`${term.title.en}, open explanation${saved ? ', saved' : ''}`} onPress={() => router.navigate({ pathname: '/term', params: { termId: term.id } })} style={({ pressed }) => ({ paddingVertical: space.lg, paddingHorizontal: space.md, minHeight: 72, gap: space.md, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? colors.accentSoft : 'transparent', borderRadius: radius.small })}>
    <Group style={{ flex: 1 }} gap={space.xs}><Txt variant="item">{term.title.en}</Txt><Txt variant="caption" muted>{term.id === 'eob' ? 'EOB · Documents' : ['deductible', 'coinsurance', 'copayment'].includes(term.id) ? 'Your share of costs' : term.id === 'appeal' ? 'Asking for a review' : term.id === 'itemized-bill' ? 'Documents' : 'Your coverage'}</Txt></Group>
    {saved ? <Icon name="bookmark" selected color={colors.accent} size={18} /> : null}<Icon name="next" size={20} color={colors.muted} />
  </Pressable>;
}
export function Guide() {
  const { locale } = useLanguage(); const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useFootnoteStore(s => s.savedTermIds);
  const starterTerms=glossary.filter(t=>['eob','deductible','appeal'].includes(t.id));
  const moreTerms=glossary.filter(t=>!['eob','deductible','appeal'].includes(t.id));
  const filtered = searchGlossary(search, locale, t).filter(term => !savedOnly || saved.includes(term.id));
  const searching = focused || !!search.trim();
  const isSearching = searching || savedOnly;
  return <><Screen softenSearchEdge scrollEdgeHeight={32} contentWidth={760} testID="guide" searchMode={searching}>
    {!searching ? <SearchTransition reveal><Group gap={space.lg}><Txt variant="display">Insurance terms</Txt><Txt muted>Definitions, examples and questions to ask.</Txt></Group></SearchTransition> : null}
    <SearchControl key="search" softenBelow active={searching} onActiveChange={setFocused} label="Search insurance terms" placeholder="EOB, deductible, appeal…" value={search} onChange={setSearch} />
    <SearchTransition><Group style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      <Button compact title="All terms" variant={savedOnly ? 'secondary' : 'quiet'} onPress={() => setSavedOnly(false)} />
      <Button compact title={`Saved${saved.length ? ` · ${saved.length}` : ''}`} icon="bookmark" variant={savedOnly ? 'quiet' : 'secondary'} onPress={() => setSavedOnly(true)} />
    </Group></SearchTransition>
    <SearchTransition>{isSearching ? <Section title={savedOnly ? 'Saved terms' : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}>
      {filtered.length ? filtered.map(term => <View key={term.id}><TermRow term={term} /><Divider /></View>) : <Group gap={space.lg}><Txt muted>{savedOnly ? 'Save a term from its explanation to keep it handy here.' : `No terms match “${search}”. Try EOB, deductible or appeal.`}</Txt><Button title={savedOnly ? 'Browse all terms' : 'Clear search'} variant="secondary" onPress={() => { setSavedOnly(false); setSearch(''); }} /></Group>}
    </Section> : <>
      <Section title="Start here"><Group gap={space.xs}>{starterTerms.map((term,index) => <View key={term.id}><TermRow term={term} />{index<starterTerms.length-1?<Divider />:null}</View>)}</Group></Section>
      <Group style={{paddingTop:space.xl}}><Section title="More useful terms"><Group gap={space.sm}>{moreTerms.map((term,index) => <View key={term.id}><TermRow term={term} />{index<moreTerms.length-1?<Divider />:null}</View>)}</Group></Section></Group>
    </>}</SearchTransition>
    {!searching ? <Txt variant="caption" muted>General explanations. Your own plan documents determine your coverage.</Txt> : null}
  </Screen></>;
}
