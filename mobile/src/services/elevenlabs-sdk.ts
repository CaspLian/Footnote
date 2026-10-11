import type { AgentSdk } from './elevenlabs-conversation';
let loading: Promise<AgentSdk> | undefined;

/** Lazy native registration lets older development builds show a recoverable message. */
export function loadAgentSdk(): Promise<AgentSdk> {
  if (!loading) {
    const pending = (async () => {
      await import('@elevenlabs/react-native');
      const { Conversation } = await import('@elevenlabs/client');
      return { Conversation } as AgentSdk;
    })();
    loading = pending;
    void pending.catch(() => { if (loading === pending) loading = undefined; });
  }
  return loading;
}
