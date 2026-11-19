// Short links (e.g. /champs-rsvp) are redirects that club members manage in the
// CMS, stored in src/data/short-links.yml. Hard-coded redirects live in
// public/_redirects; a short link may not duplicate one, nor shadow a page.

import { parse } from 'yaml';

export interface ShortLink {
  name: string;
  to: string;
}

// One lowercase path segment, words separated by single hyphens.
export const SHORT_LINK_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TARGET = /^(?:https?:\/\/\S+|\/\S*)$/;

export function parseShortLinks(yamlText: string): ShortLink[] {
  const data = parse(yamlText) ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('short links must be a map of name to { to }');
  }
  return Object.entries(data).map(([name, value]) => {
    const entry = (value ?? {}) as { to?: unknown };
    if (!SHORT_LINK_NAME.test(name)) {
      throw new Error(`short link "${name}": name must be lowercase letters, digits and hyphens`);
    }
    if (typeof entry.to !== 'string' || !TARGET.test(entry.to)) {
      throw new Error(`short link "${name}": "to" must be a URL (https://…) or a site path (/…)`);
    }
    return { name, to: entry.to };
  });
}

// The source path of each rule in a Cloudflare Pages _redirects file.
export function redirectSources(redirectsText: string): string[] {
  return redirectsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split(/\s+/)[0]);
}

const withoutTrailingSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

// Whether a _redirects source (which may use * splats or :placeholders)
// matches a path, ignoring trailing slashes.
export function sourceMatches(source: string, path: string): boolean {
  const pattern = withoutTrailingSlash(source)
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (part.startsWith(':')) return '[^/]+';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${pattern}$`).test(withoutTrailingSlash(path));
}

export interface ConflictChecks {
  hardCodedSources: string[];
  // Whether the site already serves something at this path (a page, file or function).
  pathExists: (path: string) => boolean;
}

export function findConflicts(links: ShortLink[], checks: ConflictChecks): string[] {
  return links.flatMap((link) => {
    const path = `/${link.name}`;
    const problems: string[] = [];
    const clash = checks.hardCodedSources.find((source) => sourceMatches(source, path));
    if (clash) {
      problems.push(`short link ${path} duplicates the hard-coded redirect ${clash} in public/_redirects`);
    }
    if (checks.pathExists(path)) {
      problems.push(`short link ${path} would hide an existing page or file at ${path}`);
    }
    return problems;
  });
}

// _redirects rules for the short links, with and without a trailing slash.
// They're temporary (302), as browsers may cache a permanent redirect for good,
// and a short link's destination is meant to change.
export function renderRedirects(links: ShortLink[]): string {
  return links
    .flatMap((link) => [`/${link.name} ${link.to} 302`, `/${link.name}/ ${link.to} 302`])
    .map((line) => `${line}\n`)
    .join('');
}
