import { Conversation } from '@elevenlabs/client';
import type { AgentSdk } from './elevenlabs-conversation';

// Import early to register the browser setup and arm its first-tap audio unlock.
export async function loadAgentSdk(): Promise<AgentSdk> { return { Conversation } as AgentSdk; }
