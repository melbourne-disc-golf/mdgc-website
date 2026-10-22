import { Temporal } from '@js-temporal/polyfill';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { getSeasons } from '@utils/metrix';
import { roundPath } from '@utils/social-paths';
import { getExternalEvents, excludeClubDuplicates, abbreviateLocation, type PdgaEvent } from '@utils/pdga';

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
  /** Slugs of the courses this event is held at, for per-course filtering. */
  courseSlugs?: string[];
};

/** Get all published (non-draft) club events. */
export function getPublishedEvents() {
  return getCollection('events', ({ data }) => !data.draft);
}

/** Convert a JS Date (from Zod z.date()) to a Temporal.PlainDate. */
export function dateToPlainDate(date: Date): Temporal.PlainDate {
  return Temporal.PlainDate.from(date.toISOString().slice(0, 10));
}

type ClubEventEntry = CollectionEntry<'events'>;
type CourseEntry = CollectionEntry<'courses'>;

// Metrix social day shape (a SocialDay from @utils/metrix; only these fields are used here)
type MetrixEvent = {
  id: number;
  date: string;
  courseId: string;
  courseTitle: string;
};

/**
 * Extract the first prose paragraph from a (possibly MDX) markdown body and
 * strip formatting. Skips leading non-prose blocks — MDX import/export
 * statements, JSX/HTML tags, and headings — so calendar descriptions never
 * leak source markup.
 */
function extractFirstParagraph(body: string): string | undefined {
  const paragraphs = body.split(/\n\n+/).filter((p) => p.trim());

  const prose = paragraphs.find((p) => {
    const trimmed = p.trim();
    if (/^(?:import|export)\b/.test(trimmed)) return false; // MDX import/export
    if (trimmed.startsWith('<')) return false; // JSX/HTML block
    if (trimmed.startsWith('#')) return false; // heading
    return true;
  });
  if (!prose) return undefined;

  return prose
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
    courseSlugs: courses.map((c) => c.id),
  };
}

/**
 * Convert a scraped PDGA event to a CalendarEvent.
 *
 * @param event - The PDGA event (from src/data/pdga/events.json)
 */
export function pdgaEventToCalendarEvent(event: PdgaEvent): CalendarEvent {
  return {
    summary: event.name,
    startDate: Temporal.PlainDate.from(event.startDate),
    endDate: event.endDate !== event.startDate ? Temporal.PlainDate.from(event.endDate) : undefined,
    url: `https://www.pdga.com/tour/event/${event.eventId}`,
    location: abbreviateLocation(event.location),
    external: true,
    source: 'external',
  };
}

/**
 * Scraped PDGA events as CalendarEvents, minus any that duplicate one of the
 * given club events (matched by PDGA event id). All three event surfaces
 * (calendar, tournaments page, iCal feed) combine sources through this, so a
 * club event and its PDGA listing never both appear.
 */
export function getExternalCalendarEvents(clubEvents: ClubEventEntry[]): CalendarEvent[] {
  const clubPdgaIds = new Set(
    clubEvents.map((e) => e.data.pdgaEventId).filter((id): id is string => Boolean(id))
  );
  return excludeClubDuplicates(getExternalEvents(), clubPdgaIds).map(pdgaEventToCalendarEvent);
}

/**
 * Convert a Metrix social day event to a CalendarEvent.
 *
 * @param event - The metrix event object
 * @param url - The social day's page on this site
 * @param metrixToCourse - Map of metrix course ID to course entry (for location and geo)
 */
function socialDayToCalendarEvent(
  event: MetrixEvent,
  url: string,
  metrixToCourse?: Map<string, CourseEntry>
): CalendarEvent {
  const course = metrixToCourse?.get(event.courseId);
  const location = course ? `${course.data.title}, ${course.data.suburb}` : undefined;
  const geo = course ? parseGeoJson(course.data.location) : undefined;

  return {
    summary: `MDGC Social Day - ${event.courseTitle}`,
    startDate: Temporal.PlainDate.from(event.date),
    url,
    location,
    geo,
    source: 'social',
    courseSlugs: course ? [course.id] : undefined,
    // Social days run 8am–1pm Melbourne time
    startTime: Temporal.PlainTime.from({ hour: 8, minute: 0 }),
    endTime: Temporal.PlainTime.from({ hour: 13, minute: 0 }),
  };
}

/** Every social day, across all seasons, as a CalendarEvent linking to its round page. */
export function getSocialDayCalendarEvents(metrixToCourse?: Map<string, CourseEntry>): CalendarEvent[] {
  return getSeasons().flatMap((season) =>
    season.socialDays.map((day) =>
      socialDayToCalendarEvent(day, roundPath(season, day.number), metrixToCourse)
    )
  );
}

/**
 * Gather events from all sources — club events, external events, and Metrix
 * social days — as a single list of CalendarEvents. Callers filter/sort as
 * needed (e.g. by course via `courseSlugs`, or by date).
 */
export async function getAllCalendarEvents(): Promise<CalendarEvent[]> {
  const clubEvents = await getPublishedEvents();
  const courses = await getCollection('courses');

  const coursesBySlug = new Map(courses.map((c) => [c.id, c]));
  const metrixToCourse = new Map(
    courses.flatMap((c) => (c.data.metrixCourseIds || []).map((id) => [id, c] as const))
  );

  return [
    ...clubEvents.map((e) => clubEventToCalendarEvent(e, coursesBySlug)),
    ...getExternalCalendarEvents(clubEvents),
    ...getSocialDayCalendarEvents(metrixToCourse),
  ];
}
