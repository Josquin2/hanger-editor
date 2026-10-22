export interface UrlPolicy {
  /**
   * Schemes that may appear in an `href`. Compared case-insensitively.
   * Defaults to `http`, `https`, `mailto` and `tg`.
   */
  readonly allowedSchemes?: readonly string[]
  /** Allow relative URLs such as `/channels/1`. Defaults to false. */
  readonly allowRelativeLinks?: boolean
}

export const DEFAULT_ALLOWED_SCHEMES: readonly string[] = [
  'http',
  'https',
  'mailto',
  'tg',
]

// Reject control characters and whitespace anywhere in an href.
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F]/u
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u

/**
 * Returns a URL that is safe to place in an `href`, or `null`.
 *
 * The check is deliberately allow-list based: unknown schemes, control
 * characters, embedded whitespace and protocol-relative URLs are rejected.
 */
export function sanitizeUrl(value: string, policy: UrlPolicy = {}): string | null {
  const url = value.trim()
  if (url === '') return null
  if (CONTROL_OR_SPACE.test(url)) return null
  if (url.includes('\\')) return null

  const schemeMatch = SCHEME.exec(url)
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase()
    const allowed = (policy.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES)
      .map((entry) => entry.toLowerCase())
    return allowed.includes(scheme) ? url : null
  }

  if (!policy.allowRelativeLinks) return null
  if (url.startsWith('//')) return null
  return url
}
