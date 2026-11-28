// Pages that exist but aren't meant to be found by browsing or searching:
// they're left out of the navigation and the sitemap, and marked "noindex".
// People reach them from a direct link (e.g. in an email).
export const unlistedPaths = ['/club/welcome'] as const;

function normalisePath(pathOrUrl: string): string {
  const path = /^https?:\/\//.test(pathOrUrl) ? new URL(pathOrUrl).pathname : pathOrUrl;
  return path.replace(/\/+$/, '') || '/';
}

export function isUnlisted(pathOrUrl: string): boolean {
  const path = normalisePath(pathOrUrl);
  return unlistedPaths.some((unlisted) => unlisted === path);
}
