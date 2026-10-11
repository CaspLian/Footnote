import { createElement, useEffect, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { DocumentAttachment, Language } from '@/domain';
import { Button, Feedback, Group, Txt } from '@/components/ui';
import { FootnoteLoader } from '@/components/loader';
import { radius, sizes, space } from '@/theme';
import { NativeErrorCode, nativeErrorMessage } from './errors';
import { readAttachmentBlob } from './documents.web';
export function DocumentPreview({attachment,language,style,onError,onLoad}:{attachment:DocumentAttachment;language:Language;style?:StyleProp<ViewStyle>;onError?:(code:NativeErrorCode)=>void;onLoad?:(pages:number)=>void}){const [url,setUrl]=useState('');const [error,setError]=useState('');const [revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;let objectUrl='';void readAttachmentBlob(attachment.uri).then(blob=>{objectUrl=URL.createObjectURL(blob);if(live){setUrl(objectUrl);setError('');}else URL.revokeObjectURL(objectUrl);}).catch(e=>{if(live){setError(nativeErrorMessage(e,language));onError?.('file-unavailable');}});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[attachment.uri,revision,language,onError]);
  return <View style={[{gap:space.lg},style]}><Txt variant="label">{attachment.name}</Txt>{error?<Feedback danger text={error} action={{title:'Retry preview',onPress:()=>setRevision(v=>v+1)}}/>:!url?<FootnoteLoader compact title="Opening the document" detail="Reading the copy stored in this browser."/>:attachment.mimeType==='application/pdf'?<Group>{createElement('iframe',{src:url,title:attachment.name,style:{width:'100%',height:sizes.preview+160,border:0,borderRadius:radius.control},onLoad:()=>onLoad?.(attachment.pageCount??1)})}<Txt variant="caption" muted>Your browser handles PDF passwords and page navigation. If it cannot display this file, open the original or enter details manually.</Txt><Button title="Open original PDF" variant="quiet" onPress={()=>window.open(url,'_blank','noopener,noreferrer')}/></Group>:<Image source={{uri:url}} style={{width:'100%',height:sizes.preview}} contentFit="contain" accessibilityLabel={attachment.name} onLoad={()=>onLoad?.(1)} onError={()=>setError('This photo could not be displayed. Choose a JPEG, PNG or PDF instead.')}/>}</View>;
}
