import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { clubEventToCalendarEvent, externalEventToCalendarEvent, socialDayToCalendarEvent, type CalendarEvent } from '@utils/events';

// Format a Date as an iCal date property value.
// Dates with non-zero UTC hours are treated as Melbourne local times:
//   "TZID=Australia/Melbourne:20260315T080000"
// Dates at UTC midnight are treated as all-day:
//   "VALUE=DATE:20260315"
function formatICalDate(date: Date): string {
  const ymd = formatYMD(date);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  if (hours !== 0 || minutes !== 0) {
    return `TZID=Australia/Melbourne:${ymd}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
  }
  return `VALUE=DATE:${ymd}`;
}

// Escape special characters in iCal text fields
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Make relative URLs absolute
function absoluteUrl(url: string | undefined, base: string | undefined): string | undefined {
  if (!url || !base) return url;
  return new URL(url, base).toString();
}

function formatYMD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Generate a unique ID for an event
function generateUID(event: CalendarEvent): string {
  const slug = event.summary.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${formatYMD(event.startDate)}-${slug}@melbournediscgolf.com`;
}

// Convert a CalendarEvent to iCal VEVENT format
function toVEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${generateUID(event)}`,
    `DTSTAMP:${formatYMD(new Date())}T000000Z`,
    `DTSTART;${formatICalDate(event.startDate)}`,
  ];

  if (event.endDate) {
    const endDate = new Date(event.endDate);
    // iCal DTEND is exclusive for all-day events, so add 1 day
    if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0) {
      endDate.setUTCDate(endDate.getUTCDate() + 1);
    }
    lines.push(`DTEND;${formatICalDate(endDate)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.geo) {
    lines.push(`GEO:${event.geo.lat};${event.geo.lon}`);
    // Apple Calendar needs X-APPLE-STRUCTURED-LOCATION for map previews
    // X-TITLE uses backslash escaping (same as other iCal fields), no quotes
    const locationTitle = event.location || 'Location';
    lines.push(
      `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=500;X-TITLE=${escapeText(locationTitle)}:geo:${event.geo.lat},${event.geo.lon}`
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

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.toString();
  // Get data from collections
  const clubEvents = await getCollection('events');
  const externalEvents = await getCollection('externalEvents');
  const metrixSeasons = await getCollection('metrixSeasons');
  const courses = await getCollection('courses');

  // Build course lookup maps
  const coursesBySlug = new Map(courses.map((c) => [c.id, c]));
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
    .filter((e) => e.startDate >= cutoffDate)
    .map((e) => ({ ...e, url: absoluteUrl(e.url, siteUrl) }));

  // Sort by date
  allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // VTIMEZONE for Australia/Melbourne (AEST/AEDT)
  const vtimezone = [
    'BEGIN:VTIMEZONE',
    'TZID:Australia/Melbourne',
    'BEGIN:STANDARD',
    'DTSTART:19700405T030000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
    'TZOFFSETFROM:+1100',
    'TZOFFSETTO:+1000',
    'TZNAME:AEST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19701004T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=10',
    'TZOFFSETFROM:+1000',
    'TZOFFSETTO:+1100',
    'TZNAME:AEDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n');

  // Build iCal content
  const icalLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Melbourne Disc Golf Club//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MDGC Events',
    vtimezone,
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
