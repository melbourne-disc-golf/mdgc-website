// Social Day seasons, oldest first. scripts/fetch-metrix-data.ts syncs each
// one (season and its rounds) from Metrix; the slug is used in page URLs only.
// Data is always matched on metrixId.

export interface ClubChampsConfig {
  date: string; // YYYY-MM-DD
  minimumRounds: number; // social days a member must play in the season to qualify
  places: Record<string, number>; // qualification places, by division letter
}

export interface SocialSeasonConfig {
  metrixId: string;
  slug: string;
  clubChamps?: ClubChampsConfig; // if the season is the qualifying season for club champs
}

export const socialSeasons: SocialSeasonConfig[] = [
  { metrixId: '3525269', slug: '2026-1' },
  {
    metrixId: '3647062',
    slug: '2026-2',
    // There are also 8 Female places, but Metrix doesn't say who's in that division.
    clubChamps: { date: '2026-11-22', minimumRounds: 3, places: { A: 24, B: 20, C: 14, D: 14 } },
  },
];

/** A season's display title, from its slug, e.g. "2026-2" → "2026 Season 2". */
export function seasonTitle(slug: string): string {
  const [year, number] = slug.split('-');
  return `${year} Season ${number}`;
}
