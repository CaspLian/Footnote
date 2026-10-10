import { useState } from 'react';
import { router } from 'expo-router';
import { useUnfoldStore } from '@/store';
import { Button, Field, Screen, Txt, useLanguage } from '@/components/ui';
import { CaseRow, EmptyBills } from './shared';
export function Bills() {
  const {copy}=useLanguage(); const cases=useUnfoldStore(s=>s.cases);const profiles=useUnfoldStore(s=>s.profiles); const [search,setSearch]=useState('');
  const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const filtered=cases.filter(c=>normalize(c.provider+' '+c.serviceDate+' '+(profiles.find(p=>p.id===c.profileId)?.firstName??'')).includes(normalize(search)));
  return <Screen testID="bills"><Txt variant="display">{copy('Every bill, in one place.','Tus documentos, juntos.')}</Txt><Field label={copy('Search cases','Buscar casos')} placeholder={copy('Provider or family member','Proveedor o nombre del caso')} value={search} onChangeText={setSearch} returnKeyType="search"/>{cases.length?filtered.length?filtered.map(c=><CaseRow key={c.id} billCase={c}/>):<Txt muted>{copy('No matching cases. Try a different search.','No hay casos coincidentes. Prueba otra búsqueda.')}</Txt>:<EmptyBills/>}{cases.length?<Button title={copy('Add documents','Agregar documentos')} onPress={()=>router.push('/intake')}/>:null}</Screen>;
}
