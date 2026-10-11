import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { narrationService } from '@/native';
import { Button, Feedback, Group, Txt } from './ui';
import { Icon } from './icon';
import { FootnoteLoader } from './loader';
import { useTheme, space } from '@/theme';
import { LEGACY_PRIVACY_KEY } from '@/domain/legacy-identity';
import { useTranslation } from '@/localization/use-translation';
import { FootnoteMark } from './footnote-mark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const KEY='footnote-privacy-lock-v1';
interface PrivacyState { enabled:boolean; supported:boolean; label:string; message:string; busy:boolean; toggle:()=>Promise<void>; lock:()=>void; }
const PrivacyContext=createContext<PrivacyState>({enabled:false,supported:false,label:'Biometrics',message:'',busy:false,toggle:async()=>{},lock:()=>{}});
export const usePrivacy=()=>useContext(PrivacyContext);
export function PrivacyProvider({children}:{children:ReactNode}) { const { colors } = useTheme(); const insets=useSafeAreaInsets(); const {t}=useTranslation();
  const [ready,setReady]=useState(Platform.OS==='web');const [enabled,setEnabled]=useState(false);const [locked,setLocked]=useState(false);const [supported,setSupported]=useState(false);const [label,setLabel]=useState('Biometrics');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [readError,setReadError]=useState(false);const authenticating=useRef(false);
  async function initialize(){try{const flag=await SecureStore.getItemAsync(KEY)??await SecureStore.getItemAsync(LEGACY_PRIVACY_KEY);const [hardware,types]=await Promise.all([LocalAuthentication.hasHardwareAsync(),LocalAuthentication.supportedAuthenticationTypesAsync()]);setSupported(hardware);setLabel(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)?'Face ID':types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)?Platform.OS==='ios'?'Touch ID':'Fingerprint':'Biometrics');setEnabled(flag==='1');setLocked(flag==='1');setReadError(false);setReady(true);}catch{setReadError(true);}}
  useEffect(()=>{if(Platform.OS!=='web')void Promise.resolve().then(initialize);},[]);
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(enabled&&state==='background'&&!authenticating.current){setLocked(true);void narrationService.stop().catch(()=>{});}});return()=>sub.remove();},[enabled]);
  async function authenticate(){if(authenticating.current)return false;authenticating.current=true;setBusy(true);setMessage('');try{const result=await LocalAuthentication.authenticateAsync({promptMessage:t('Unlock your private Footnote workspace'),cancelLabel:t('Cancel'),fallbackLabel:t('Use device passcode'),disableDeviceFallback:false,biometricsSecurityLevel:'strong'});if(!result.success){setMessage(result.error==='user_cancel'||result.error==='system_cancel'?'Authentication cancelled. Your workspace remains locked.':'Authentication could not finish. Try again or use your device passcode.');return false;}return true;}catch{setMessage('Authentication is unavailable. Try again using device authentication.');return false;}finally{authenticating.current=false;setBusy(false);}}
  async function toggle(){if(Platform.OS==='web')return;if(!enabled){if(!supported||!await LocalAuthentication.isEnrolledAsync()){setMessage('Set up Face ID or a fingerprint in device settings before enabling this option.');return;}}if(!await authenticate())return;try{await SecureStore.setItemAsync(KEY,enabled?'0':'1',{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});setEnabled(!enabled);setLocked(false);setMessage(enabled?'App lock is off.':'App lock is on. Authentication is required after reopening Footnote.');}catch{setMessage('The app-lock preference could not be saved. Try again.');}}
  const value={enabled,supported,label,message,busy,toggle,lock:()=>{setLocked(true);void narrationService.stop().catch(()=>{});}};
  if(!ready)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',padding:space.screen}}>{readError?<Feedback danger text="Privacy settings could not be read. Retry to open your workspace." action={{title:'Try again',onPress:()=>void initialize()}}/>:<FootnoteLoader title="Opening your workspace" detail="Checking your local privacy settings."/>}</View>;
  return <PrivacyContext.Provider value={value}>{locked?<View style={{flex:1,backgroundColor:colors.background,padding:space.xl,paddingTop:insets.top+space.xl,paddingBottom:insets.bottom+space.xl}}>
    <Group gap={space.sm} style={{alignItems:'center'}}><FootnoteMark size={48}/><Txt variant="heading" style={{textAlign:'center'}}>Footnote</Txt></Group>
    <View style={{flex:1,justifyContent:'center'}}><Group gap={space.xl} style={{maxWidth:420,width:'100%',alignSelf:'center',alignItems:'center'}}><Icon name="lock" size={40} color={colors.accent}/><Txt variant="display" style={{textAlign:'center'}}>Workspace locked</Txt><Txt muted style={{textAlign:'center'}}>Use {label} or your device passcode to open your bills and family profiles.</Txt><Button title={`Unlock with ${label}`} icon="lock" loading={busy} style={{alignSelf:'stretch',width:'100%'}} onPress={()=>{void authenticate().then(ok=>{if(ok)setLocked(false);});}}/>{message?<Feedback text={message}/>:null}</Group></View>
  </View>:children}</PrivacyContext.Provider>;
}
