import { describe, it, expect } from 'vitest';
import { roundPath, seasonPath } from './social-paths';

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
