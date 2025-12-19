import type { CollectionEntry } from 'astro:content';
import type { CalendarEvent } from '@components/EventCalendar.astro';

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

const SITE_URL = 'https://www.melbournediscgolf.com';

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
    startDate: event.data.date,
    endDate: event.data.endDate,
    url: `${SITE_URL}/events/${event.slug}`,
    location: locationText || undefined,
    geo,
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
    startDate: new Date(event.data.date),
    endDate: event.data.endDate ? new Date(event.data.endDate) : undefined,
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
    startDate: new Date(event.date),
    url: `https://discgolfmetrix.com/${event.id}`,
    location,
    geo,
    external: true,
    source: 'social',
  };
}
