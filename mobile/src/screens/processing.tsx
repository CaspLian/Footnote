import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useUnfoldStore } from '@/store';
import { Button, Feedback, Group, Screen, Txt } from '@/components/ui';
import { UnfoldLoader } from '@/components/loader';
import { Icon } from '@/components/icon';
import { useTheme, space } from '@/theme';
import { MissingCase, useCase } from './shared';
const stages=['Reviewing your confirmed details','Checking available evidence','Preparing a plain-language explanation'];
export function Processing(){ const { colors } = useTheme();const c=useCase();const [stage,setStage]=useState(0);const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [complete,setComplete]=useState(false);const caseId=c?.id;
useEffect(()=>{if(!caseId)return;let live=true;const timers:ReturnType<typeof setTimeout>[]=[];const delay=(ms:number)=>new Promise<void>(resolve=>{timers.push(setTimeout(resolve,ms));});async function work(){try{await delay(250);if(!live)return;setStage(1);await useUnfoldStore.getState().verifyCase(caseId!);if(!live)return;setStage(2);await delay(350);if(live)setComplete(true);}catch{if(live)setError('The review could not finish. Your documents and confirmed details are saved. Try again or return to verification.');}}void work();return()=>{live=false;timers.forEach(clearTimeout);};},[caseId,revision]);
if(!c)return <MissingCase/>;
return <Screen testID="processing" footer={complete?<Button title="Open my review" onPress={()=>router.replace({pathname:'/review',params:{caseId:c.id}})}/>:<Button title="Return to details" variant="quiet" onPress={()=>router.replace({pathname:'/verify',params:{caseId:c.id}})}/>}><UnfoldLoader settled={complete||!!error} title={complete?'A clearer picture is ready.':'A clearer picture is taking shape.'} detail={c.source==='sample'?'Reviewing the local synthetic example.':c.evidenceContextId?'Reviewing the document details you confirmed.':'Organizing the details you entered manually.'}/><Group gap={space.screen}>{stages.map((title,index)=><Group key={title} style={{flexDirection:'row',alignItems:'center',gap:space.lg}}><Icon name={complete||index<stage?'check':'document'} color={index<=stage?colors.accent:colors.muted}/><Txt variant="label" muted={!complete&&index>stage} style={{flex:1}}>{title}</Txt></Group>)}</Group><Txt variant="caption" muted>{c.source==='sample'?'Original sources support this demo’s questions.':'Imported documents use your confirmed details; automated comparison findings are not connected yet.'} Regional benchmarks and sponsor voice services are not connected yet.</Txt>{error?<Feedback danger text={error} action={{title:'Try the review again',onPress:()=>{setError('');setStage(0);setComplete(false);setRevision(v=>v+1);}}}/>:null}</Screen>;
}
