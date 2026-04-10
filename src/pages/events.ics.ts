import { Temporal } from '@js-temporal/polyfill';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { clubEventToCalendarEvent, externalEventToCalendarEvent, socialDayToCalendarEvent, type CalendarEvent } from '@utils/events';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Format a PlainDate as iCal YYYYMMDD
function formatYMD(date: Temporal.PlainDate): string {
  return `${date.year}${pad2(date.month)}${pad2(date.day)}`;
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

// Generate a unique ID for an event
function generateUID(event: CalendarEvent): string {
  const slug = event.summary.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${formatYMD(event.startDate)}-${slug}@melbournediscgolf.com`;
}

// Format DTSTART or DTEND property
function formatDateProp(prop: string, date: Temporal.PlainDate, time?: Temporal.PlainTime): string {
  if (time) {
    return `${prop};TZID=Australia/Melbourne:${formatYMD(date)}T${pad2(time.hour)}${pad2(time.minute)}00`;
  }
  return `${prop};VALUE=DATE:${formatYMD(date)}`;
}

// Convert a CalendarEvent to iCal VEVENT format
function toVEvent(event: CalendarEvent): string {
  const now = Temporal.Now.plainDateISO();
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${generateUID(event)}`,
    `DTSTAMP:${formatYMD(now)}T000000Z`,
    formatDateProp('DTSTART', event.startDate, event.startTime),
  ];

  if (event.endTime) {
    lines.push(formatDateProp('DTEND', event.endDate || event.startDate, event.endTime));
  } else if (event.endDate) {
    // iCal DTEND is exclusive for all-day events, so add 1 day
    lines.push(formatDateProp('DTEND', event.endDate.add({ days: 1 })));
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.geo) {
    lines.push(`GEO:${event.geo.lat};${event.geo.lon}`);
    const locationTitle = event.location || 'Location';
    lines.push(
      `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=500;X-TITLE=${escapeText(locationTitle)}:geo:${event.geo.lat},${event.geo.lon}`
    );
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
  const cutoff = Temporal.Now.plainDateISO().subtract({ days: 30 });

  const allEvents = [...clubCalendarEvents, ...externalCalendarEvents, ...socialDays]
    .filter((e) => Temporal.PlainDate.compare(e.startDate, cutoff) >= 0)
    .map((e) => ({ ...e, url: absoluteUrl(e.url, siteUrl) }));

  // Sort by date
  allEvents.sort((a, b) => Temporal.PlainDate.compare(a.startDate, b.startDate));

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
