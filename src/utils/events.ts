import type { CollectionEntry } from 'astro:content';
import type { CalendarEvent } from '@components/EventCalendar.astro';

type EventEntry = CollectionEntry<'events'>;
type CourseEntry = CollectionEntry<'courses'>;

/**
 * Convert an event content entry to a CalendarEvent.
 *
 * @param event - The event content entry
 * @param coursesBySlug - Map of course slug to course entry (for resolving location)
 */
export function toCalendarEvent(
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
