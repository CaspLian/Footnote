import { useEffect, useState } from 'react';
import { backendConfigured, type BackendVoiceCatalog } from '../services/backend';
import { loadVoiceCatalog } from '../services/voice-catalog';
export function useVoiceCatalogState(revision = 0) {
  const [catalog, setCatalog] = useState<BackendVoiceCatalog>();
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    if (backendConfigured()) void loadVoiceCatalog(revision > 0).then(value => { if (live) { setCatalog(value); setError(''); } }).catch(() => { if (live) setError('Voices could not be loaded. Check your connection and try again.'); });
    return () => { live = false; };
  }, [revision]);
  return { catalog, error };
}
export function useVoiceCatalog(revision = 0) { return useVoiceCatalogState(revision).catalog; }
