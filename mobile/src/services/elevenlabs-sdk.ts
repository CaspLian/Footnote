import type { AgentSdk } from './elevenlabs-conversation';
let loading: Promise<AgentSdk> | undefined;

/** Lazy native registration lets older development builds show a recoverable message. */
export function loadAgentSdk(): Promise<AgentSdk> {
  if (!loading) {
    const pending = (async () => {
      await import('@elevenlabs/react-native');
      const { setupIOSAudioManagement } = await import('@livekit/react-native');
      // Keep duplex audio during agent playout as well as user speech. The SDK's
      // default playout-only policy uses playback, which can drop microphone input.
      const duplex = { audioCategory: 'playAndRecord' as const, audioMode: 'voiceChat' as const, audioCategoryOptions: ['allowBluetooth', 'defaultToSpeaker'] as ('allowBluetooth'|'defaultToSpeaker')[] };
      setupIOSAudioManagement(true, { recording: duplex, playout: duplex });
      const { Conversation } = await import('@elevenlabs/client');
      return { Conversation } as AgentSdk;
    })();
    loading = pending;
    void pending.catch(() => { if (loading === pending) loading = undefined; });
  }
  return loading;
}
