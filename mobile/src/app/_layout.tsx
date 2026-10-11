import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useNarrationInterruptions } from '@/native';
import { useFonts } from 'expo-font';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useUnfoldStore } from '@/store';
import { installGeminiUnderstanding } from '@/services/gemini-understanding';
import { PrivacyProvider } from '@/components/privacy';
import { WebShell } from '@/components/web-shell';
import { UnfoldLoader } from '@/components/loader';
import { GlassCloseButton } from '@/components/sheet';
import { toolbarIcons } from '@/components/toolbar-icons';
import { Button, Feedback, Screen, Txt, useLanguage, useDesktop } from '@/components/ui';
import { AppearanceProvider, useTheme, fonts, type } from '@/theme';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';

void SplashScreen.preventAutoHideAsync().catch(() => {});
installGeminiUnderstanding(); // with EXPO_PUBLIC_API_URL set, "Understanding your documents" asks the backend's Gemini
export default function RootLayout() { return <GestureHandlerRootView style={{ flex: 1 }}><KeyboardProvider><AppearanceProvider><RootContent /></AppearanceProvider></KeyboardProvider></GestureHandlerRootView>; }
function RootContent() {
  const { colors, scheme, reducedMotion } = useTheme();
  const [loaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const desktop=useDesktop();
  const hydrated = useUnfoldStore(s => s.hydrated);
  const hydrationError = useUnfoldStore(s => s.hydrationError);
  const { locale, copy } = useLanguage();
  useNarrationInterruptions(locale);

  useEffect(() => { if ((loaded || fontError) && hydrated) void SplashScreen.hideAsync(); }, [loaded, fontError, hydrated]);
  if (!loaded && !fontError || !hydrated) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><UnfoldLoader title="Opening your workspace" detail="Your documents and profiles stay here."/></View>;
  if (hydrationError) return <Screen><Txt variant="title">{copy('Your saved data could not be loaded.','No se pudieron cargar tus datos guardados.')}</Txt><Feedback text={copy('Retry before starting a new local workspace.','Intenta de nuevo antes de crear un espacio local nuevo.')} action={{ title: copy('Try again','Intentar de nuevo'), onPress: () => { void useUnfoldStore.getState().retryHydration(); } }} /><Button title={copy('Start an empty workspace','Crear un espacio vacío')} variant="secondary" onPress={() => { void useUnfoldStore.getState().recoverEmpty(); }} /></Screen>;
  return <><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><ThemeProvider value={{ ...(scheme === 'dark' ? DarkTheme : DefaultTheme), colors: { ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors, background: colors.background, card: colors.surface, text: colors.ink, primary: colors.accent, border: colors.line } }}><PrivacyProvider><WebShell><Stack screenOptions={{ headerShown: !desktop, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink, headerTitleStyle: { fontFamily: fonts.semibold, fontSize: type.section.fontSize }, headerShadowVisible: false, scrollEdgeEffects: { top: 'hidden' }, headerTitleAlign: 'left', gestureEnabled: true, animation: reducedMotion ? 'fade' : 'default', headerRight: () => null, headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="welcome" options={{ title: 'Unfold', headerLeft: () => null }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="languages" options={{title:'Working language',presentation:Platform.OS==='ios'?'formSheet':'modal',sheetAllowedDetents:[0.85,1],sheetGrabberVisible:true,headerLeft:()=>null}}/>
    <Stack.Screen name="onboarding" options={{ title: 'Personal setup', headerRight: () => null }} />
    <Stack.Screen name="profiles" options={{ title: 'Family profiles', headerRight: () => null }} />
    <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'card', headerRight: () => null }} />
    <Stack.Screen name="processing" options={{ title: 'Reviewing your bill', headerBackButtonMenuEnabled: false }} />
    <Stack.Screen name="intake" options={{ title: copy('Add documents','Agregar documentos') }} />
    <Stack.Screen name="camera" options={{ title: copy('Take a photo','Tomar una foto'), presentation: 'fullScreenModal', headerRight: () => null }} />
    <Stack.Screen name="confirm-documents" options={{ title: 'Your documents' }} />
    <Stack.Screen name="understanding" options={{ title: 'Understanding your documents', headerBackButtonMenuEnabled: false }} />
    <Stack.Screen name="verify" options={{ title: copy('Verify details','Verificar datos') }} />
    <Stack.Screen name="review" options={{ title: copy('Bill review','Revisar factura') }} />
    <Stack.Screen name="finding" options={{ title: copy('Question & evidence','Pregunta y evidencia') }} />
    <Stack.Screen name="draft" options={{ title: copy('Prepare your request','Preparar solicitud') }} />
    <Stack.Screen name="call-script" options={{ title: copy('Call script','Guion de llamada') }} />
    <Stack.Screen name="timeline" options={{ title: copy('Case timeline','Cronología') }} />
    <Stack.Screen name="document" options={{ title: copy('Document','Documento'), presentation: 'modal', headerBackVisible: false, headerLeft: () => null, headerRight: Platform.OS === 'ios' ? undefined : () => <GlassCloseButton label="Close document" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)')} /> }}>{Platform.OS === 'ios' ? <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon={toolbarIcons.close} tintColor={colors.ink} iconRenderingMode="template" accessibilityLabel="Close document" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)')}>Close document</Stack.Toolbar.Button></Stack.Toolbar> : null}</Stack.Screen>
    <Stack.Screen name="term" options={{ title: 'Guide', headerRight: () => null }} />
    <Stack.Screen name="voices" options={{ title: 'Agent voice', headerRight: () => null }} />
    <Stack.Screen name="settings" options={{ title: copy('Settings','Ajustes'), presentation: 'card', headerRight: () => null }} />
  </Stack></WebShell></PrivacyProvider></ThemeProvider></>;
}
