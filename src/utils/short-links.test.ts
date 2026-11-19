import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  findConflicts,
  parseShortLinks,
  redirectSources,
  renderRedirects,
  sourceMatches,
  type ShortLink,
} from './short-links';

describe('parseShortLinks', () => {
  it('reads a map of names to targets', () => {
    const links = parseShortLinks(`
champs-rsvp:
  to: https://forms.gle/abc
rules:
  to: /disc-golf/try#rules
`);
    expect(links).toEqual([
      { name: 'champs-rsvp', to: 'https://forms.gle/abc' },
      { name: 'rules', to: '/disc-golf/try#rules' },
    ]);
  });

  it('accepts an empty file', () => {
    expect(parseShortLinks('')).toEqual([]);
    expect(parseShortLinks('{}')).toEqual([]);
  });

  it.each(['Champs', 'a--b', 'a/b', '-a', 'a b'])('rejects the name %j', (name) => {
    expect(() => parseShortLinks(`"${name}":\n  to: /club\n`)).toThrow(/name/);
  });

  it.each(['club', 'ftp://x', '/a b', ''])('rejects the target %j', (to) => {
    expect(() => parseShortLinks(`x:\n  to: "${to}"\n`)).toThrow(/"to"/);
  });


  it('rejects a list', () => {
    expect(() => parseShortLinks('- to: /club\n')).toThrow(/map/);
  });
});

describe('redirectSources', () => {
  it('lists the source of each rule, skipping comments and blank lines', () => {
    expect(redirectSources('# comment\n\n/about /club 301\n  /shop/ https://x 302\n')).toEqual(['/about', '/shop/']);
  });
});

describe('sourceMatches', () => {
  it('ignores trailing slashes', () => {
    expect(sourceMatches('/about/', '/about')).toBe(true);
    expect(sourceMatches('/about', '/about/')).toBe(true);
  });

  it('matches splats and placeholders', () => {
    expect(sourceMatches('/product-tag/*', '/product-tag/frisbee')).toBe(true);
    expect(sourceMatches('/:anything', '/foo')).toBe(true);
    expect(sourceMatches('/:anything', '/foo/bar')).toBe(false);
  });

  it('matches literally otherwise', () => {
    expect(sourceMatches('/a.b', '/axb')).toBe(false);
    expect(sourceMatches('/about', '/about-us')).toBe(false);
  });
});

describe('findConflicts', () => {
  const link = (name: string): ShortLink => ({ name, to: '/club' });

  it('reports a short link that duplicates a hard-coded redirect', () => {
    const problems = findConflicts([link('about'), link('fine')], {
      hardCodedSources: ['/about/'],
      pathExists: () => false,
    });
    expect(problems).toEqual(['short link /about duplicates the hard-coded redirect /about/ in public/_redirects']);
  });

  it('reports a short link that would hide a page', () => {
    const problems = findConflicts([link('events'), link('fine')], {
      hardCodedSources: [],
      pathExists: (path) => path === '/events',
    });
    expect(problems).toEqual(['short link /events would hide an existing page or file at /events']);
  });
});

describe('renderRedirects', () => {
  it('writes a temporary rule with and without a trailing slash', () => {
    expect(renderRedirects([{ name: 'x', to: 'https://y' }])).toBe('/x https://y 302\n/x/ https://y 302\n');
  });
});

// The CMS can't see the rest of the site, so its pattern for short-link names
// reserves the names already in use. These tests keep that list up to date.
describe('the CMS short-link name pattern', () => {
  const root = new URL('../../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

  const cmsConfig = parse(read('public/cms/config.yml'));
  const shortLinksFile = cmsConfig.collections
    .flatMap((collection: { files?: unknown[] }) => collection.files ?? [])
    .find((file: { name: string }) => file.name === 'short-links');
  const nameField = shortLinksFile.fields[0].fields.find((field: { name: string }) => field.name === 'name');
  const pattern = new RegExp(nameField.pattern[0]);

  const topLevelNames = (dir: string) =>
    readdirSync(new URL(dir, root))
      .filter((entry) => !entry.startsWith('_') && !entry.startsWith('.'))
      .map((entry) => entry.replace(/\.(astro|mdx?|ts|js)$/, ''));

  const hardCodedNames = redirectSources(read('public/_redirects'))
    .map((source) => source.replace(/^\/|\/$/g, ''))
    .filter((name) => !name.includes('/'));

  const takenNames = [
    ...new Set([...topLevelNames('src/pages/'), ...topLevelNames('public/'), ...topLevelNames('functions/'), ...hardCodedNames]),
  ].filter((name) => /^[a-z0-9-]+$/.test(name));

  it('rejects names already used by pages, files and hard-coded redirects', () => {
    expect(takenNames.filter((name) => pattern.test(name))).toEqual([]);
  });

  it('accepts the existing short links', () => {
    const names = parseShortLinks(read('src/data/short-links.yml')).map((link) => link.name);
    expect(names.filter((name) => !pattern.test(name))).toEqual([]);
  });

  it.each(['Champs', 'a--b', 'a/b', '-a'])('rejects the malformed name %j', (name) => {
    expect(pattern.test(name)).toBe(false);
  });
});
