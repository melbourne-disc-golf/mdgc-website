import { describe, it, expect } from 'vitest';
import { currentOrNextSeason } from './seasons';

const s1 = { slug: '2026-1', dateStart: '2026-02-01', dateEnd: '2026-06-20' };
const s2 = { slug: '2026-2', dateStart: '2026-07-01', dateEnd: '2026-11-15' };
const s3 = { slug: '2027-1', dateStart: '2027-02-07', dateEnd: '2027-06-27' };
const seasons = [s3, s2, s1]; // newest first, as getSeasons() returns them

describe('currentOrNextSeason', () => {
  it('finds the season in progress', () => {
    expect(currentOrNextSeason(seasons, '2026-10-23')).toEqual({ season: s2, status: 'current' });
  });

  it('counts the first and last days as part of the season', () => {
    expect(currentOrNextSeason(seasons, '2026-07-01')?.season).toBe(s2);
    expect(currentOrNextSeason(seasons, '2026-11-15')?.season).toBe(s2);
  });

  it('finds the next season, between seasons', () => {
    expect(currentOrNextSeason(seasons, '2026-12-01')).toEqual({ season: s3, status: 'next' });
  });

  it('picks the soonest season when more than one is still to come', () => {
    expect(currentOrNextSeason(seasons, '2026-01-01')).toEqual({ season: s1, status: 'next' });
  });

  it('finds nothing after the last season', () => {
    expect(currentOrNextSeason(seasons, '2027-07-01')).toBeNull();
  });

  it('ignores seasons without a start date', () => {
    const undated: { slug: string; dateStart?: string } = { slug: 'x' };
    expect(currentOrNextSeason([undated], '2026-10-23')).toBeNull();
  });

  it('treats a season with no end date as still in progress', () => {
    const open = { slug: 'open', dateStart: '2026-07-01' };
    expect(currentOrNextSeason([open], '2026-12-25')).toEqual({ season: open, status: 'current' });
  });
});
