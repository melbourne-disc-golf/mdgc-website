import { describe, it, expect } from 'vitest';
import {
  divisionAnchor,
  divisionLinks,
  divisionParam,
  roundPath,
  seasonLadderPath,
  seasonPath,
  seasonRoundsPath,
  seasonStatsPath,
} from './social-paths';

describe('seasonPath', () => {
  it('uses the season slug', () => {
    expect(seasonPath({ slug: '2026-1' })).toBe('/events/social/seasons/2026-1');
  });
});

describe('seasonRoundsPath', () => {
  it('nests rounds under the season', () => {
    expect(seasonRoundsPath({ slug: '2026-1' })).toBe('/events/social/seasons/2026-1/rounds');
  });
});

describe('seasonLadderPath', () => {
  it('nests the ladder under the season', () => {
    expect(seasonLadderPath({ slug: '2026-2' })).toBe('/events/social/seasons/2026-2/ladder');
  });
});

describe('seasonStatsPath', () => {
  it('nests stats under the season', () => {
    expect(seasonStatsPath({ slug: '2026-1' })).toBe('/events/social/seasons/2026-1/stats');
  });

  it('can narrow to one division', () => {
    expect(seasonStatsPath({ slug: '2026-1' }, 'A')).toBe('/events/social/seasons/2026-1/stats/div/a');
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
