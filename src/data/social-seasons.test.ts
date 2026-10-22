import { describe, it, expect } from 'vitest';
import { seasonTitle, socialSeasons } from './social-seasons';

describe('socialSeasons', () => {
  it('has unique Metrix ids', () => {
    const ids = socialSeasons.map((s) => s.metrixId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique slugs', () => {
    const slugs = socialSeasons.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses <year>-<season number> slugs', () => {
    for (const { slug } of socialSeasons) {
      expect(slug).toMatch(/^\d{4}-\d+$/);
    }
  });
});

describe('seasonTitle', () => {
  it('names the season by year and number', () => {
    expect(seasonTitle('2026-2')).toBe('2026 Season 2');
  });
});
