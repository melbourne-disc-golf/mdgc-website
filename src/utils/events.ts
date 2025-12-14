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
  // Build location from courses if available
  const courseNames = (event.data.courses || [])
    .map((ref) => coursesBySlug?.get(ref.id)?.data.title || ref.id)
    .join(', ');

  return {
    summary: event.data.title,
    startDate: event.data.date,
    endDate: event.data.endDate,
    url: `/events/${event.slug}`,
    location: courseNames || undefined,
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
 * @param metrixToCourse - Map of metrix course ID to course name (for location)
 */
export function socialDayToCalendarEvent(
  event: MetrixEvent,
  metrixToCourse?: Map<string, string>
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

  return {
    summary: shortName,
    startDate: new Date(event.date),
    url: `https://discgolfmetrix.com/${event.id}`,
    location: metrixToCourse?.get(event.courseId),
    external: true,
    source: 'social',
  };
}
