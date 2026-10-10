/** Opacity follows distance from each edge, including native adjusted insets. */
export function scrollEdgeOpacity(offset: number, content: number, viewport: number, topInset = 0, bottomInset = 0) {
  'worklet';
  const travel = Math.max(0, content + topInset + bottomInset - viewport);
  if (travel <= 1 || viewport <= 0) return { top: 0, bottom: 0 };
  const position = Math.max(0, Math.min(travel, offset + topInset));
  return { top: Math.min(1, position / 24), bottom: Math.min(1, (travel - position) / 28) };
}
