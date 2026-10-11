import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { Button, Feedback, Group, Screen, Txt } from '@/components/ui';
import { FootnoteLoader } from '@/components/loader';
import { Icon } from '@/components/icon';
import { useTheme, space } from '@/theme';
import { MissingCase, useCase } from './shared';
import { backendConfigured } from '@/services';
import { reviewWithMinimumDuration } from '@/services/review-timing';
const stages=['Reviewing your confirmed details','Checking available evidence','Preparing a plain-language explanation'];
export function Processing(){ const { colors } = useTheme();const c=useCase();const [stage,setStage]=useState(0);const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [complete,setComplete]=useState(false);const caseId=c?.id;
useEffect(()=>{if(!caseId)return;let live=true;const abort=new AbortController();const timers=[setTimeout(()=>{if(live)setStage(1);},450),setTimeout(()=>{if(live)setStage(2);},4500)];async function work(){try{await reviewWithMinimumDuration(()=>useFootnoteStore.getState().verifyCase(caseId!),{signal:abort.signal,minimumMs:backendConfigured()?6000:600});if(live)setComplete(true);}catch{if(live)setError('The review could not finish. Your documents and confirmed details are saved. Try again or return to verification.');}}void work();return()=>{live=false;abort.abort();timers.forEach(clearTimeout);};},[caseId,revision]);
if(!c)return <MissingCase/>;
return <Screen testID="processing" footer={complete?<Button title="Open my review" onPress={()=>router.replace({pathname:'/review',params:{caseId:c.id}})}/>:<Button title="Return to details" variant="quiet" onPress={()=>router.replace({pathname:'/verify',params:{caseId:c.id}})}/>}><FootnoteLoader settled={complete||!!error} title={complete?'Review ready':'Reviewing your bill'} detail={backendConfigured()?'Comparing each billing code with Medicare’s national rates.':c.evidenceContextId?'Reviewing the document details you confirmed.':'Organizing the details you entered manually.'}/><Group gap={space.screen}>{stages.map((title,index)=><Group key={title} style={{flexDirection:'row',alignItems:'center',gap:space.lg}}><Icon name={complete||index<stage?'check':'document'} color={index<=stage?colors.accent:colors.muted}/><Txt variant="label" muted={!complete&&index>stage} style={{flex:1}}>{title}</Txt></Group>)}</Group><Txt variant="caption" muted>{backendConfigured()?'Prices are compared with Medicare’s national rates (CMS 2026), not regional data. A difference is a reason to ask, not proof of an error.':'Imported documents use your confirmed details; automated comparison findings are not connected yet.'}</Txt>{error?<Feedback danger text={error} action={{title:'Try the review again',onPress:()=>{setError('');setStage(0);setComplete(false);setRevision(v=>v+1);}}}/>:null}</Screen>;
}
