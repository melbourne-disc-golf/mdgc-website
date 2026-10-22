import { describe, it, expect } from 'vitest';
import { divisionAnchor, divisionLinks, divisionParam, roundPath, seasonPath } from './social-paths';

describe('seasonPath', () => {
  it('uses the season slug', () => {
    expect(seasonPath({ slug: '2026-1' })).toBe('/events/social/seasons/2026-1');
  });

  it('can narrow to one division', () => {
    expect(seasonPath({ slug: '2026-1' }, 'A')).toBe('/events/social/seasons/2026-1/div/a');
  });
});

describe('roundPath', () => {
  it('nests the round number under the season', () => {
    expect(roundPath({ slug: '2026-1' }, 3)).toBe('/events/social/seasons/2026-1/rounds/3');
  });
});

describe('divisionParam', () => {
  it('is undefined for all divisions', () => {
    expect(divisionParam()).toBeUndefined();
  });

  it('names one division', () => {
    expect(divisionParam('B')).toBe('div/b');
  });
});

describe('divisionLinks', () => {
  it('leads with All, and marks the current division', () => {
    const links = divisionLinks(['A', 'B'], 'B', (d) => (d ? `/x/${d}` : '/x'));
    expect(links).toEqual([
      { text: 'All', href: '/x', current: false },
      { text: 'A', href: '/x/A', current: false },
      { text: 'B', href: '/x/B', current: true },
    ]);
  });
});

describe('divisionAnchor', () => {
  it('uses the division letter', () => {
    expect(divisionAnchor('A')).toBe('div-A');
  });

  it('falls back to "other" for an unknown division', () => {
    expect(divisionAnchor('?')).toBe('div-other');
  });
});
