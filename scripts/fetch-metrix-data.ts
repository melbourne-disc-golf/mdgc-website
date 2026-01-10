#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

interface MetrixCompetition {
  ID: string;
  Name: string;
  Date: string;
  Time: string;
  CourseName: string;
  CourseID: string;
  TourDateStart?: string;
  TourDateEnd?: string;
}

interface MetrixEvent {
  ID: string;
  Name: string;
}

interface MetrixResponse {
  Competition: MetrixCompetition & {
    Events?: MetrixEvent[];
    SubCompetitions?: MetrixEvent[];
  };
}

const DATA_DIR = path.join(process.cwd(), 'src', 'content', 'metrixSeasons');

async function fetchFromMetrix(id: string): Promise<MetrixResponse> {
  const url = `https://discgolfmetrix.com/api.php?content=result&id=${id}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from Metrix: ${response.statusText}`);
  }
  return response.json();
}

async function fetchSeasonData(seasonId: string) {
  // Ensure data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Fetch season data
  const seasonData = await fetchFromMetrix(seasonId);

  // Fetch and collect each event (API uses either Events or SubCompetitions)
  const events = seasonData.Competition.Events || seasonData.Competition.SubCompetitions || [];
  const eventsList = [];

  for (const event of events) {
    console.log(`Fetching event ${event.ID}: ${event.Name}...`);
    const eventData = await fetchFromMetrix(event.ID);

    const eventInfo = {
      id: eventData.Competition.ID,
      name: eventData.Competition.Name,
      date: eventData.Competition.Date,
      time: eventData.Competition.Time,
      courseName: eventData.Competition.CourseName,
      courseId: eventData.Competition.CourseID,
    };

    eventsList.push(eventInfo);
    console.log(`  Fetched: ${eventInfo.name} - ${eventInfo.date}`);

    // Small delay to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Save all season data in one file
  const seasonFile = {
    id: seasonData.Competition.ID,
    name: seasonData.Competition.Name,
    dateStart: seasonData.Competition.TourDateStart,
    dateEnd: seasonData.Competition.TourDateEnd,
    eventCount: events.length,
    events: eventsList,
  };

  fs.writeFileSync(
    path.join(DATA_DIR, `${seasonId}.json`),
    JSON.stringify(seasonFile, null, 2)
  );
  console.log(`\nSaved season ${seasonId}: ${seasonFile.name} with ${events.length} events`);
}

async function main() {
  const seasonIds = process.argv.slice(2);

  if (seasonIds.length === 0) {
    console.error('Please provide one or more season IDs.');
    console.error('Usage: ./fetch-metrix-data.ts <seasonId> [seasonId...]');
    process.exit(1);
  }

  console.log(`Fetching data for ${seasonIds.length} season(s)...\n`);

  for (const seasonId of seasonIds) {
    await fetchSeasonData(seasonId);
    console.log('');
  }

  console.log('All done!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
