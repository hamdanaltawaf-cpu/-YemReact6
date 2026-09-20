/** Exact host mapping for a trusted reverse proxy; never infer a public origin from client input. */
export function matchesPublicHost(host: string | null, publicOrigin: string, proxyHost?: string) {
  if (!host) return false;
  try {
    return host === new URL(publicOrigin).host || Boolean(proxyHost && host === proxyHost);
  } catch {
    return false;
  }
}
export function isSameOriginRequest(
  origin: string | null,
  host: string | null,
  publicOrigin?: string,
  proxyHost?: string,
  fetchSite?: string | null,
) {
  if (!origin || !host || fetchSite === 'cross-site') return false;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    if (parsed.host === host) return true;
    return Boolean(
      publicOrigin && origin === new URL(publicOrigin).origin && proxyHost && host === proxyHost,
    );
  } catch {
    return false;
  }
}
