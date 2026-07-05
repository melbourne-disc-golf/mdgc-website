#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { parseEvents, keepEvent } from '../src/utils/pdga-scrape';
import type { PdgaEvent } from '../src/utils/pdga';

// We scrape the PDGA's public tour search rather than their API (which needs
// developer-program access we don't have). Events are filtered by tier and
// region here (see keepEvent) so the stored JSON is the curated list the site
// shows. Re-run whenever the schedule changes:
//   just fetch-pdga-events

const COUNTRIES = ['Australia', 'New Zealand'];
const MONTHS_AHEAD = 12;
const OUTPUT = path.join(process.cwd(), 'src', 'data', 'pdga', 'events.json');

// PDGA's robots.txt asks for a 10s crawl delay.
const CRAWL_DELAY_MS = 10_000;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function searchUrl(minDate: string, maxDate: string, page: number): string {
  const params = new URLSearchParams();
  params.set('date_filter[min][date]', minDate);
  params.set('date_filter[max][date]', maxDate);
  for (const country of COUNTRIES) params.append('Country[]', country);
  if (page > 0) params.set('page', String(page));
  return `https://www.pdga.com/tour/search?${params.toString()}`;
}

async function fetchPage(url: string): Promise<string> {
  console.log(`Fetching ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'mdgc-website event sync (https://melbournediscgolf.com)' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setMonth(maxDate.getMonth() + MONTHS_AHEAD);
  const minDate = ymd(now);
  const maxDateStr = ymd(maxDate);

  const collected = new Map<number, PdgaEvent>();

  // Walk the paginated results until a page yields no rows.
  for (let page = 0; ; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
    const html = await fetchPage(searchUrl(minDate, maxDateStr, page));
    const events = parseEvents(html);
    if (events.length === 0) break;
    for (const event of events) collected.set(event.eventId, event);
  }

  const kept = [...collected.values()]
    .filter(keepEvent)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

  fs.writeFileSync(OUTPUT, JSON.stringify(kept, null, 2) + '\n');
  console.log(`\nWrote ${kept.length} events (of ${collected.size} found) to ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
