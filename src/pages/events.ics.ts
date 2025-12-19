import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { clubEventToCalendarEvent, externalEventToCalendarEvent, socialDayToCalendarEvent } from '@utils/events';
import type { CalendarEvent } from '@components/EventCalendar.astro';

// Format date as iCal DATE (YYYYMMDD)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Escape special characters in iCal text fields
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate a unique ID for an event
function generateUID(event: CalendarEvent): string {
  const dateStr = formatDate(event.startDate);
  const slug = event.summary.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${dateStr}-${slug}@melbournediscgolf.com`;
}

// Convert a CalendarEvent to iCal VEVENT format
function toVEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${generateUID(event)}`,
    `DTSTAMP:${formatDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${formatDate(event.startDate)}`,
  ];

  if (event.endDate) {
    // iCal DTEND is exclusive, so add 1 day for all-day events
    const endDate = new Date(event.endDate);
    endDate.setDate(endDate.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatDate(endDate)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.geo) {
    lines.push(`GEO:${event.geo.lat};${event.geo.lon}`);
    // Apple Calendar needs X-APPLE-STRUCTURED-LOCATION for map previews
    const locationTitle = event.location?.split(',')[0] || 'Location';
    lines.push(
      `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=500;X-TITLE="${escapeText(locationTitle)}":geo:${event.geo.lat},${event.geo.lon}`
    );
    // Microsoft Outlook uses these properties
    lines.push(`X-MICROSOFT-LATITUDE:${event.geo.lat}`);
    lines.push(`X-MICROSOFT-LONGITUDE:${event.geo.lon}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export const GET: APIRoute = async () => {
  // Get data from collections
  const clubEvents = await getCollection('events');
  const externalEvents = await getCollection('externalEvents');
  const metrixSeasons = await getCollection('metrixSeasons');
  const courses = await getCollection('courses');

  // Build course lookup maps
  const coursesBySlug = new Map(courses.map((c) => [c.slug, c]));
  const metrixToCourse = new Map(
    courses.flatMap((c) =>
      (c.data.metrixCourseIds || []).map((id) => [id, c] as const)
    )
  );

  // Convert all events to CalendarEvents
  const clubCalendarEvents = clubEvents.map((e) =>
    clubEventToCalendarEvent(e, coursesBySlug)
  );

  const externalCalendarEvents = externalEvents.map((e) =>
    externalEventToCalendarEvent(e)
  );

  const socialDays = metrixSeasons
    .flatMap((season) => season.data.events)
    .map((e) => socialDayToCalendarEvent(e, metrixToCourse));

  // Filter out events more than 30 days in the past
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const allEvents = [...clubCalendarEvents, ...externalCalendarEvents, ...socialDays]
    .filter((e) => e.startDate >= cutoffDate);

  // Sort by date
  allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Build iCal content
  const icalLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Melbourne Disc Golf Club//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MDGC Events',
    ...allEvents.map(toVEvent),
    'END:VCALENDAR',
  ];

  const icalContent = icalLines.join('\r\n');

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
    },
  });
};
