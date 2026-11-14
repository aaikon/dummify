/**
 * Site identity used for per-site settings (e.g. "disable blocking on this site").
 *
 * Returns the lowercased hostname without a leading "www.", or `null` for pages
 * the extension never acts on (non-http(s) schemes, invalid URLs).
 */
export function normalizeHost(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (host === '') return null;
  return host.startsWith('www.') ? host.slice('www.'.length) : host;
}

/** A TLD such as `com`, `fi`, `co.uk`, `com.au`. Approximates the public-suffix list for big-site TLDs. */
const TLD = /^[a-z]{2,6}(?:\.[a-z]{2})?$/;

/**
 * Matches a normalized host (see {@link normalizeHost}) against a rule host pattern:
 *
 * - `example.com` matches `example.com` and any subdomain (`mail.example.com`).
 * - `google.*` matches `google.<tld>` for any country TLD (`google.com`, `google.co.uk`, `google.fi`),
 *   but **not** subdomains (`mail.google.com`), so search rules don't leak into other Google products.
 */
export function hostMatches(host: string, pattern: string): boolean {
  if (pattern.endsWith('.*')) {
    const base = pattern.slice(0, -1); // keep the trailing dot: "google."
    return host.startsWith(base) && TLD.test(host.slice(base.length));
  }
  return host === pattern || host.endsWith(`.${pattern}`);
}
