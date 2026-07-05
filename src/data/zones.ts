// Social-day "zones" — the club rotates social days around three regions,
// one per weekend of the month. See /events/social.
// A course's `zone` marks it as a social-day venue (a "main" course).

export interface Zone {
  slug: string;
  label: string;
}

export const zones: Zone[] = [
  { slug: 'west', label: 'West' },
  { slug: 'south-east', label: 'South-East' },
  { slug: 'north-east', label: 'North-East' },
];

export const zoneSlugs = zones.map((zone) => zone.slug);
