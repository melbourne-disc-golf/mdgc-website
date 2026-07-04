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
  Competition:
    | ({
        ID: number | string;
        Events?: MetrixChild[];
        SubCompetitions?: MetrixChild[];
      } & Record<string, unknown>)
    | null;
  Errors?: string[];
}

// Raw Metrix responses are stored here verbatim; src/utils/metrix.ts does all
// the shaping at build time.
const RAW_DIR = path.join(process.cwd(), 'src', 'data', 'metrix');

async function fetchFromMetrix(id: string): Promise<MetrixResponse> {
  const url = `https://discgolfmetrix.com/api.php?content=result&id=${id}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${id} from Metrix: ${response.statusText}`);
  }
  return (await response.json()) as MetrixResponse;
}

function childIds(data: MetrixResponse): string[] {
  const children = data.Competition?.Events || data.Competition?.SubCompetitions || [];
  return children.map((c) => c.ID);
}

// Fetch an id and everything beneath it, saving each response verbatim.
async function fetchRawRecursive(id: string, seen: Set<string>) {
  if (seen.has(id)) return;
  seen.add(id);

  const data = await fetchFromMetrix(id);

  // The public API only serves data less than ~1 year old; older ids come back
  // with a null Competition and an Errors message. Don't persist those.
  if (!data.Competition) {
    console.warn(`Skipping ${id}: ${data.Errors?.join('; ') ?? 'no Competition in response'}`);
    return;
  }

  fs.writeFileSync(path.join(RAW_DIR, `${id}.json`), JSON.stringify(data, null, 2) + '\n');

  for (const childId of childIds(data)) {
    await new Promise((resolve) => setTimeout(resolve, 200)); // be nice to the API
    await fetchRawRecursive(childId, seen);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const seasonIds = args.length ? args : SEASON_IDS;

  fs.mkdirSync(RAW_DIR, { recursive: true });

  console.log(`Syncing ${seasonIds.length} season(s)...\n`);

  const seen = new Set<string>();
  for (const seasonId of seasonIds) {
    await fetchRawRecursive(seasonId, seen);
  }

  console.log(`\nDone. Synced ${seen.size} Metrix records across ${seasonIds.length} season(s).`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
