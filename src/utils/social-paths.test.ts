import { describe, it, expect } from 'vitest';
import { divisionAnchor, roundPath, seasonPath } from './social-paths';

describe('seasonPath', () => {
  it('uses the season slug', () => {
    expect(seasonPath({ slug: '2026-1' })).toBe('/events/social/seasons/2026-1');
  });
});

describe('roundPath', () => {
  it('nests the round number under the season', () => {
    expect(roundPath({ slug: '2026-1' }, 3)).toBe('/events/social/seasons/2026-1/rounds/3');
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
