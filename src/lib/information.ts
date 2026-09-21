/** Map legacy fragments without accepting a caller-provided redirect URL. */
export function legacyInformationDestination(hash: string): string | null {
  let fragment: string;
  try {
    fragment = decodeURIComponent(hash.replace(/^#/, '')).toLowerCase();
  } catch {
    return null;
  }
  return fragment === 'privacy' ? '/privacy' : null;
}
