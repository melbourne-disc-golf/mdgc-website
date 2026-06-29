// Helpers for distinguishing and handling off-site links.

// A link is off-site if it's an absolute http(s) URL (internal links are root-relative).
export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

// Anchor attributes for off-site links (new tab, safe rel); empty for internal.
export function externalLinkAttrs(href: string): { target?: string; rel?: string } {
  return isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
