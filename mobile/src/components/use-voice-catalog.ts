import { useEffect, useState } from 'react';
import { backendConfigured, type BackendVoiceCatalog } from '../services/backend';
import { loadVoiceCatalog } from '../services/voice-catalog';
export function useVoiceCatalog() {
  const [catalog, setCatalog] = useState<BackendVoiceCatalog>();
  useEffect(() => { let live = true; if (backendConfigured()) void loadVoiceCatalog().then(value => { if (live) setCatalog(value); }).catch(() => {}); return () => { live = false; }; }, []);
  return catalog;
}
