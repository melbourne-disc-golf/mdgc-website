// Site-facing reader for the PDGA events we've scraped into
// src/data/pdga/events.json. The scraping/parsing/filtering lives in
// pdga-scrape.ts, which is imported only by the fetch script and its tests —
// keeping the HTML parser out of the site bundle.

export interface PdgaEvent {
  name: string;
  eventId: number;
  tier: string;
  location: string; // "City, State, Country"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (equals startDate for single-day events)
}

const AU_STATE_ABBR: Record<string, string> = {
  'victoria': 'VIC',
  'new south wales': 'NSW',
  'queensland': 'QLD',
  'south australia': 'SA',
  'western australia': 'WA',
  'tasmania': 'TAS',
  'northern territory': 'NT',
  'australian capital territory': 'ACT',
};

/**
 * Shorten PDGA's "City, State, Country" for display, matching the style of our
 * hand-written external events ("Bendigo, VIC"):
 *   "Bendigo, Victoria, Australia" → "Bendigo, VIC"
 *   "Te Kuiti, New Zealand"        → "Te Kuiti, NZ"
 *
 * Australian state names are abbreviated; anything unrecognised is left as-is.
 */
export function abbreviateLocation(location: string): string {
  const segments = location.split(',').map((s) => s.trim());
  const country = segments[segments.length - 1]?.toLowerCase() ?? '';

  if (country === 'australia' && segments.length >= 3) {
    const state = segments[segments.length - 2];
    const city = segments.slice(0, -2).join(', ');
    return `${city}, ${AU_STATE_ABBR[state.toLowerCase()] ?? state}`;
  }
  if (country === 'new zealand') {
    return `${segments.slice(0, -1).join(', ')}, NZ`;
  }
  return location;
}

/**
 * Drop scraped PDGA events that duplicate one of our own club events, matched
 * by PDGA event id — a club event with `pdgaEventId` and its scraped twin are
 * the same tournament, and we present our own page for it.
 */
export function excludeClubDuplicates(events: PdgaEvent[], clubPdgaIds: Set<string>): PdgaEvent[] {
  return events.filter((e) => !clubPdgaIds.has(String(e.eventId)));
}

/** The scraped external events, as stored in src/data/pdga/events.json. */
export function getExternalEvents(): PdgaEvent[] {
  const modules = import.meta.glob('../data/pdga/events.json', { eager: true });
  const mod = Object.values(modules)[0] as { default?: PdgaEvent[] } | undefined;
  return mod?.default ?? [];
}
