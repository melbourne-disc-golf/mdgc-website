import { describe, it, expect } from 'vitest';
import { socialSeasons } from '../data/social-seasons';
import { getSeasons, splitDivisionName } from './metrix';

describe('splitDivisionName', () => {
  it('splits a Metrix class name into a label and a description', () => {
    expect(splitDivisionName('Div A - Metrix Rating > 890')).toEqual({
      label: 'Div A',
      description: 'Metrix Rating > 890',
    });
    expect(splitDivisionName('Div Z - Non MDGC Members')).toEqual({
      label: 'Div Z',
      description: 'Non MDGC Members',
    });
  });

  it('splits on the first separator only', () => {
    expect(splitDivisionName('Div C - Metrix Rating 790 - 845')).toEqual({
      label: 'Div C',
      description: 'Metrix Rating 790 - 845',
    });
  });

  it('has no description when there is no separator', () => {
    expect(splitDivisionName('Unranked')).toEqual({ label: 'Unranked', description: null });
  });
});

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
