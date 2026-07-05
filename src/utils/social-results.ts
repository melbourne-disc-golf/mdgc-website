import type { Season } from '@utils/metrix';

export function socialSeasonSlug(season: Pick<Season, 'id' | 'name'>): string {
  if (/\bS2\b/i.test(season.name)) return 's2';
  if (/\bS1\b/i.test(season.name)) return 's1';
  if (/MDGC\s+2026\s+Social\s+Days$/i.test(season.name.trim())) return 's1';

  const match = season.name.match(/Season\s+(\d+)/i);
  return match ? `s${match[1]}` : String(season.id);
}

export function socialRoundSlug(roundNumber: number): string {
  return `rd-${String(roundNumber).padStart(2, '0')}`;
}

export function socialRoundAnchor(season: Pick<Season, 'id' | 'name'>, roundNumber: number): string {
  return `${socialSeasonSlug(season)}-${socialRoundSlug(roundNumber)}`;
}

export function legacySocialRoundAnchor(season: Pick<Season, 'id' | 'name'>, roundNumber: number): string {
  return `social-results-${season.id}-rd-${String(roundNumber).padStart(2, '0')}`;
}

export function socialSeasonResultsHref(season: Pick<Season, 'id' | 'name'>, baseHref = '/events/social/results'): string {
  return `${baseHref}/${socialSeasonSlug(season)}`;
}

export function socialSeasonStatsHref(season: Pick<Season, 'id' | 'name'>, baseHref = '/events/social/results'): string {
  return `${socialSeasonResultsHref(season, baseHref)}/stats`;
}

export function socialRoundResultsHref(season: Pick<Season, 'id' | 'name'>, roundNumber: number, baseHref = '/events/social/results'): string {
  return `${socialSeasonResultsHref(season, baseHref)}/${socialRoundSlug(roundNumber)}`;
}
