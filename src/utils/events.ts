import type { CollectionEntry } from 'astro:content';
import type { CalendarEvent } from '@components/EventCalendar.astro';

type EventEntry = CollectionEntry<'events'>;
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
 * Convert an event content entry to a CalendarEvent.
 *
 * @param event - The event content entry
 * @param coursesBySlug - Map of course slug to course entry (for resolving location)
 */
export function eventEntryToCalendarEvent(
  event: EventEntry,
  coursesBySlug?: Map<string, CourseEntry>
): CalendarEvent {
  // Build location from courses if available, otherwise use location field
  const courseNames = (event.data.courses || [])
    .map((ref) => coursesBySlug?.get(ref.id)?.data.title || ref.id)
    .join(', ');

  return {
    summary: event.data.title,
    startDate: event.data.date,
    endDate: event.data.endDate,
    url: event.data.external ? event.data.url : `/events/${event.slug}`,
    location: courseNames || event.data.location,
    external: event.data.external,
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
  const shortName = event.name.includes('→')
    ? event.name.split('→').pop()?.trim() || event.name
    : event.name;

  return {
    summary: shortName,
    startDate: new Date(event.date),
    url: `https://discgolfmetrix.com/${event.id}`,
    location: metrixToCourse?.get(event.courseId),
    external: true,
  };
}
