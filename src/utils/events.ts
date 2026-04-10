import { Temporal } from '@js-temporal/polyfill';
import type { CollectionEntry } from 'astro:content';

export type EventSource = 'club' | 'social' | 'external';

export type CalendarEvent = {
  summary: string;
  startDate: Temporal.PlainDate;
  endDate?: Temporal.PlainDate;
  startTime?: Temporal.PlainTime;
  endTime?: Temporal.PlainTime;
  url?: string;
  location?: string;
  geo?: { lat: number; lon: number };
  description?: string;
  external?: boolean;
  source?: EventSource;
};

/** Convert a JS Date (from Zod z.date()) to a Temporal.PlainDate. */
export function dateToPlainDate(date: Date): Temporal.PlainDate {
  return Temporal.PlainDate.from(date.toISOString().slice(0, 10));
}

type ClubEventEntry = CollectionEntry<'events'>;
type ExternalEventEntry = CollectionEntry<'externalEvents'>;
type CourseEntry = CollectionEntry<'courses'>;

// Metrix social day event shape (from metrixSeasons collection)
type MetrixEvent = {
  id: number;
  name: string;
  date: string;
  time: string;
  courseName: string;
  courseId: string;
};

/**
 * Extract the first paragraph from markdown body and strip formatting.
 */
function extractFirstParagraph(body: string): string | undefined {
  const paragraphs = body.split(/\n\n+/).filter((p) => p.trim());
  if (!paragraphs.length) return undefined;

  return paragraphs[0]
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1') // *italic* → italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .trim();
}

/**
 * Parse GeoJSON Point location string to lat/lon.
 */
function parseGeoJson(location: string | undefined): { lat: number; lon: number } | undefined {
  if (!location) return undefined;
  try {
    const geo = JSON.parse(location);
    if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
      // GeoJSON coordinates are [longitude, latitude]
      return { lat: geo.coordinates[1], lon: geo.coordinates[0] };
    }
  } catch {
    // Invalid JSON, ignore
  }
  return undefined;
}

/**
 * Convert a club event content entry to a CalendarEvent.
 *
 * @param event - The club event content entry
 * @param coursesBySlug - Map of course slug to course entry (for resolving location)
 */
export function clubEventToCalendarEvent(
  event: ClubEventEntry,
  coursesBySlug?: Map<string, CourseEntry>
): CalendarEvent {
  // Build location from courses if available (include suburb for map previews)
  const courses = (event.data.courses || [])
    .map((ref) => coursesBySlug?.get(ref.id))
    .filter((c): c is CourseEntry => c !== undefined);

  const locationText = courses
    .map((c) => `${c.data.title}, ${c.data.suburb}`)
    .join(' & ');

  // Use the first course's coordinates for geo
  const firstCourse = courses[0];
  const geo = firstCourse ? parseGeoJson(firstCourse.data.location) : undefined;

  return {
    summary: event.data.title,
    startDate: dateToPlainDate(event.data.date),
    endDate: event.data.endDate ? dateToPlainDate(event.data.endDate) : undefined,
    url: `/events/${event.id}`,
    location: locationText || undefined,
    geo,
    description: event.body ? extractFirstParagraph(event.body) : undefined,
    source: 'club',
  };
}

/**
 * Convert an external event data entry to a CalendarEvent.
 *
 * @param event - The external event data entry
 */
export function externalEventToCalendarEvent(
  event: ExternalEventEntry
): CalendarEvent {
  return {
    summary: event.data.title,
    startDate: dateToPlainDate(event.data.date),
    endDate: event.data.endDate ? dateToPlainDate(event.data.endDate) : undefined,
    url: event.data.url,
    location: event.data.location,
    external: true,
    source: 'external',
  };
}

/**
 * Convert a Metrix social day event to a CalendarEvent.
 *
 * @param event - The metrix event object
 * @param metrixToCourse - Map of metrix course ID to course entry (for location and geo)
 */
export function socialDayToCalendarEvent(
  event: MetrixEvent,
  metrixToCourse?: Map<string, CourseEntry>
): CalendarEvent {
  // Extract short name from full metrix name
  // e.g. "MDGC 2025 Social Days: Season 2 → July West Social Day - Melton"
  // Handle both actual → character and &rarr; HTML entity
  let shortName = event.name;
  if (event.name.includes('→')) {
    shortName = event.name.split('→').pop()?.trim() || event.name;
  } else if (event.name.includes('&rarr;')) {
    shortName = event.name.split('&rarr;').pop()?.trim() || event.name;
  }

  const course = metrixToCourse?.get(event.courseId);
  const location = course ? `${course.data.title}, ${course.data.suburb}` : undefined;
  const geo = course ? parseGeoJson(course.data.location) : undefined;

  return {
    summary: shortName,
    startDate: Temporal.PlainDate.from(event.date),
    url: `https://discgolfmetrix.com/${event.id}`,
    location,
    geo,
    external: true,
    source: 'social',
    // Social days run 8am–1pm Melbourne time
    startTime: Temporal.PlainTime.from({ hour: 8, minute: 0 }),
    endTime: Temporal.PlainTime.from({ hour: 13, minute: 0 }),
  };
}
