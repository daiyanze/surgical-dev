export const CONFIRMATION_PHRASES = new Set(['确认开始', 'confirmandstart']);
export const CONFIRMATION_SEPARATORS = /[\s,.!;:，。！；：、]/g;
export const CONFIRMATION_QUOTES = /[`"'“”‘’]/;

// Only the exact benign phrase counts as consent. Questions, negation, conditions and quoted text are rejected.
export function isExplicitConfirmation(text) {
  if (typeof text !== 'string') return false;
  const value = text.trim();
  if (!value || CONFIRMATION_QUOTES.test(value)) return false;
  return CONFIRMATION_PHRASES.has(value.toLowerCase().replace(CONFIRMATION_SEPARATORS, ''));
}
