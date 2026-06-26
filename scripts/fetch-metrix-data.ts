#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

// Metrix tour IDs to sync, in chronological order. Add new seasons here.
// Each is fetched recursively (season → its rounds). Override on the command
// line for one-off fetches: `tsx scripts/fetch-metrix-data.ts <id> [id...]`.
const SEASON_IDS = [
  '3525269', // 2026 Social Days S1
  '3647062', // 2026 Social Days S2
];

interface MetrixChild {
  ID: string;
  Name: string;
}

interface MetrixResponse {
  Competition: {
    ID: number | string;
    Name: string;
    Date: string;
    Time: string;
    CourseName: string;
    CourseID: string;
    TourDateStart?: string;
    TourDateEnd?: string;
    Events?: MetrixChild[];
    SubCompetitions?: MetrixChild[];
  } & Record<string, unknown>;
}

// Raw Metrix responses are stored here verbatim; src/utils/metrix.ts does all
// the shaping at build time.
const RAW_DIR = path.join(process.cwd(), 'src', 'data', 'metrix');

// TODO(calendar cleanup): the events calendar still consumes the derived
// `metrixSeasons` content collection written by writeCalendarSeason() below.
// Once the calendar reads raw Metrix data via src/utils/metrix.ts, drop that
// derivation and the metrixSeasons collection, leaving this a pure raw fetcher.
const SEASONS_DIR = path.join(process.cwd(), 'src', 'content', 'metrixSeasons');

const cache = new Map<string, MetrixResponse>();

async function fetchFromMetrix(id: string): Promise<MetrixResponse> {
  const cached = cache.get(id);
  if (cached) return cached;
  const url = `https://discgolfmetrix.com/api.php?content=result&id=${id}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${id} from Metrix: ${response.statusText}`);
  }
  const data = (await response.json()) as MetrixResponse;
  cache.set(id, data);
  return data;
}

function childIds(data: MetrixResponse): string[] {
  const children = data.Competition.Events || data.Competition.SubCompetitions || [];
  return children.map((c) => c.ID);
}

// Fetch an id and everything beneath it, saving each response verbatim.
async function fetchRawRecursive(id: string, seen: Set<string>) {
  if (seen.has(id)) return;
  seen.add(id);

  const data = await fetchFromMetrix(id);
  fs.writeFileSync(path.join(RAW_DIR, `${id}.json`), JSON.stringify(data, null, 2) + '\n');

  for (const childId of childIds(data)) {
    await new Promise((resolve) => setTimeout(resolve, 200)); // be nice to the API
    await fetchRawRecursive(childId, seen);
  }
}

// TODO(calendar cleanup): derive this from raw in src/utils/metrix.ts instead.
function writeCalendarSeason(seasonId: string) {
  const season = cache.get(seasonId)!.Competition;
  const children = season.Events || season.SubCompetitions || [];
  const events = children.map((c) => {
    const ev = cache.get(c.ID)!.Competition;
    return {
      id: Number(ev.ID),
      name: ev.Name,
      date: ev.Date,
      time: ev.Time,
      courseName: ev.CourseName,
      courseId: ev.CourseID,
    };
  });

  fs.writeFileSync(
    path.join(SEASONS_DIR, `${seasonId}.json`),
    JSON.stringify(
      {
        id: Number(season.ID),
        name: season.Name,
        dateStart: season.TourDateStart,
        dateEnd: season.TourDateEnd,
        eventCount: events.length,
        events,
      },
      null,
      2
    )
  );
}

async function main() {
  const args = process.argv.slice(2);
  const seasonIds = args.length ? args : SEASON_IDS;

  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(SEASONS_DIR, { recursive: true });

  console.log(`Syncing ${seasonIds.length} season(s)...\n`);

  const seen = new Set<string>();
  for (const seasonId of seasonIds) {
    await fetchRawRecursive(seasonId, seen);
    writeCalendarSeason(seasonId);
  }

  console.log(`\nDone. Synced ${seen.size} Metrix records across ${seasonIds.length} season(s).`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
