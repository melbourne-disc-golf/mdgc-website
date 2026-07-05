import { describe, it, expect } from 'vitest';
import { abbreviateLocation, excludeClubDuplicates, type PdgaEvent } from './pdga';

describe('abbreviateLocation', () => {
  it('abbreviates Australian states', () => {
    expect(abbreviateLocation('Bendigo, Victoria, Australia')).toBe('Bendigo, VIC');
    expect(abbreviateLocation('Warner, Queensland, Australia')).toBe('Warner, QLD');
    expect(abbreviateLocation('Belair, South Australia, Australia')).toBe('Belair, SA');
  });

  it('abbreviates New Zealand', () => {
    expect(abbreviateLocation('Te Kuiti, New Zealand')).toBe('Te Kuiti, NZ');
    expect(abbreviateLocation('Auckland, New Zealand')).toBe('Auckland, NZ');
  });

  it('leaves unrecognised states and countries as-is', () => {
    expect(abbreviateLocation('Emporia, Kansas, United States')).toBe('Emporia, Kansas, United States');
  });
});

describe('excludeClubDuplicates', () => {
  const event = (eventId: number): PdgaEvent => ({
    name: 'x', eventId, tier: 'C', location: 'x, Victoria, Australia',
    startDate: '2026-07-25', endDate: '2026-07-25',
  });

  it('drops PDGA events whose id matches a club event, keeping the rest', () => {
    const events = [event(104141), event(104188), event(105160)];
    const kept = excludeClubDuplicates(events, new Set(['104141', '104188']));
    expect(kept.map((e) => e.eventId)).toEqual([105160]);
  });

  it('keeps everything when there are no club PDGA ids', () => {
    const events = [event(104141)];
    expect(excludeClubDuplicates(events, new Set())).toEqual(events);
  });
});
