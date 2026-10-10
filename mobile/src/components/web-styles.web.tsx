import { colors } from '@/theme';
export function WebStyles() {
  return <style>{`
    ::selection { background: ${colors.accentSoft}; color: ${colors.ink}; }
    input, textarea { caret-color: ${colors.accent}; }
    :focus-visible { outline: 3px solid ${colors.accent}; outline-offset: 3px; }
    * { scrollbar-color: ${colors.line} transparent; scrollbar-width: thin; }
  `}</style>;
}
