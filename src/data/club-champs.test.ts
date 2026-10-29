import { describe, it, expect } from 'vitest';
import { clubChampsQualifications, ladderPlaces, qualificationForEvent, qualificationPath } from './club-champs';
import { socialSeasons } from './social-seasons';

describe('clubChampsQualifications', () => {
  it('has one entry per event', () => {
    const ids = clubChampsQualifications.map((q) => q.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('qualifies from configured social day seasons', () => {
    const slugs = socialSeasons.map((s) => s.slug);
    for (const q of clubChampsQualifications) {
      expect(slugs).toContain(q.seasonSlug);
    }
  });
});

describe('qualificationForEvent', () => {
  it('finds an event by id', () => {
    expect(qualificationForEvent('2026-11-22-club-champs')?.seasonSlug).toBe('2026-2');
  });

  it('is undefined for other events', () => {
    expect(qualificationForEvent('2026-12-13-mdgc-junior-club-championships')).toBeUndefined();
  });
});

describe('ladderPlaces', () => {
  it('gives morning places for lettered divisions only', () => {
    const places = ladderPlaces({
      eventId: 'e',
      seasonSlug: 's',
      minimumRounds: 3,
      fieldCaps: [
        { division: 'A', morning: 24, finals: 12 },
        { division: 'B', morning: 20, finals: 10 },
        { division: 'Female', morning: 8, finals: 4 },
      ],
    });
    expect(places).toEqual({ A: 24, B: 20 });
  });
});

describe('qualificationPath', () => {
  it('nests under the event', () => {
    expect(qualificationPath('2026-11-22-club-champs')).toBe('/events/2026-11-22-club-champs/qualification');
  });
});
