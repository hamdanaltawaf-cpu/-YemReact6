/** Return a trimmed optional situation only when it adds information beyond the title. */
export function distinctSituation(caption: string, situation?: string | null): string | null {
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const visible = situation?.trim() ?? '';
  if (!visible || normalize(visible) === normalize(caption)) return null;
  return visible;
}
