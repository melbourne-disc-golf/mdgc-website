import { describe, it, expect } from 'vitest';
import { socialSeasons } from './social-seasons';

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
