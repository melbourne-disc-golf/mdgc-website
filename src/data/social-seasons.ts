// Social Day seasons, oldest first. scripts/fetch-metrix-data.ts syncs each
// one (season and its rounds) from Metrix; the slug is used in page URLs only.
// Data is always matched on metrixId.

export interface SocialSeasonConfig {
  metrixId: string;
  slug: string;
}

export const socialSeasons: SocialSeasonConfig[] = [
  { metrixId: '3525269', slug: '2026-1' },
  { metrixId: '3647062', slug: '2026-2' },
];
