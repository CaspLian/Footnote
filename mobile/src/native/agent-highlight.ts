import { useEffect, useSyncExternalStore } from 'react';
import { highlightStore } from '../services/agent-tools';

export function useAgentHighlight(caseId: string | undefined): string | undefined {
  const highlight = useSyncExternalStore(highlightStore.subscribe, highlightStore.get, highlightStore.get);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => { if (highlightStore.get() === highlight) highlightStore.set(undefined); }, Math.max(0, 20_000 - (Date.now() - highlight.at)));
    return () => clearTimeout(timer);
  }, [highlight]);
  return highlight?.caseId === caseId ? highlight?.findingId : undefined;
}
