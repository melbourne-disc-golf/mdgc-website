#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { parseSeasonLinks, parseSeasonPrizes } from '../src/utils/mdgc-sd-scrape';
import type { SocialPrizesByEvent } from '../src/utils/social-prizes';

// Scrapes social day prize winners from mdgc-sd's public results pages, as a
// stopgap until prize data moves off mdgc-sd. Any failure exits non-zero
// before writing, so the last good data stays in place:
//   just fetch-mdgc-sd-prizes

const HOME_URL = 'https://mdgc-sd.vercel.app/';
const OUTPUT = path.join(process.cwd(), 'src', 'data', 'mdgc-sd', 'prize-winners.json');

async function fetchPage(url: string): Promise<string> {
  console.log(`Fetching ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'mdgc-website prize sync (https://melbournediscgolf.com)' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const seasonUrls = parseSeasonLinks(await fetchPage(HOME_URL), HOME_URL);
  if (seasonUrls.length === 0) {
    throw new Error(`No season results pages linked from ${HOME_URL}`);
  }

  const prizes: SocialPrizesByEvent = {};
  for (const url of seasonUrls) {
    for (const [eventId, round] of Object.entries(parseSeasonPrizes(await fetchPage(url)))) {
      if (prizes[eventId]) {
        throw new Error(`Metrix event ${eventId} has prizes on more than one season page`);
      }
      prizes[eventId] = round;
    }
  }

  const eventIds = Object.keys(prizes).sort((a, b) => Number(a) - Number(b));
  if (eventIds.length === 0) {
    throw new Error('Found no prize winners on any season page');
  }
  const sorted = Object.fromEntries(eventIds.map((id) => [id, prizes[id]]));

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\nWrote prizes for ${eventIds.length} rounds to ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
