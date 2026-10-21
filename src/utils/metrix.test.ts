import { describe, it, expect } from 'vitest';
import { socialSeasons } from '../data/social-seasons';
import { getSeasons } from './metrix';

describe('getSeasons', () => {
  it('returns only configured seasons, each with its configured slug', () => {
    const slugById = new Map(socialSeasons.map((s) => [Number(s.metrixId), s.slug]));
    const seasons = getSeasons();
    expect(seasons.length).toBeGreaterThan(0);
    for (const season of seasons) {
      expect(season.slug).toBe(slugById.get(season.id));
    }
  });
});
