// Club champs qualification: which social day season qualifies players for
// which club champs event, and how. Matched to the event (in the events
// content collection) by its id, and to the season by its slug.

export interface ClubChampsQualification {
  eventId: string; // e.g. "2026-11-22-club-champs"
  seasonSlug: string; // the qualifying social day season, e.g. "2026-2"
  minimumRounds: number; // social days a member must play in the season to qualify
  fieldCaps: FieldCap[]; // by division, in the order to show them
}

export interface FieldCap {
  division: string; // a division letter, or e.g. "Female"
  morning: number; // places in the morning round, i.e. qualification places
  finals: number; // places in the finals
}

export const clubChampsQualifications: ClubChampsQualification[] = [
  {
    eventId: '2026-11-22-club-champs',
    seasonSlug: '2026-2',
    minimumRounds: 3,
    fieldCaps: [
      { division: 'A', morning: 24, finals: 12 },
      { division: 'B', morning: 20, finals: 10 },
      { division: 'C', morning: 14, finals: 7 },
      { division: 'D', morning: 14, finals: 7 },
      { division: 'Female', morning: 8, finals: 4 },
    ],
  },
];

export function qualificationForEvent(eventId: string): ClubChampsQualification | undefined {
  return clubChampsQualifications.find((q) => q.eventId === eventId);
}

/**
 * Qualification places on the ladder, by division letter. Metrix doesn't say
 * who's in a division like Female, so the ladder has only lettered divisions.
 */
export function ladderPlaces(qualification: ClubChampsQualification): Record<string, number> {
  return Object.fromEntries(
    qualification.fieldCaps.filter((c) => /^[A-Z]$/.test(c.division)).map((c) => [c.division, c.morning]),
  );
}

/** The page listing who's qualifying for a club champs event. */
export function qualificationPath(eventId: string): string {
  return `/events/${eventId}/qualification`;
}
