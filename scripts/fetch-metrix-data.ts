#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

interface MetrixEventRef {
  ID: string;
  Name: string;
}

// A per-hole score within a player's round (completed holes only;
// unplayed holes come through as an empty array instead of an object).
interface MetrixPlayerHole {
  Result?: string;
  Diff?: number;
}

interface MetrixResult {
  UserID: string;
  Name: string;
  Group?: string;
  PlayerResults: (MetrixPlayerHole | unknown[])[];
  Sum: number;
  Diff: number;
  Place: number;
}

// Weekly-handicap standings: where divisions, ratings and net scores live.
interface MetrixWeeklyHC {
  UserID: number;
  Name: string;
  ClassName: string;
  Rating: number;
  Result: number; // gross, matches MetrixResult.Sum
  HC: number;
}

interface MetrixTourResult {
  UserID: string;
  Name: string;
  Place: number;
  EventResults: (number | null)[];
  Total: number;
}

interface MetrixCompetition {
  ID: number | string;
  Name: string;
  Date: string;
  Time: string;
  CourseName: string;
  CourseID: string;
  TourDateStart?: string;
  TourDateEnd?: string;
  Events?: MetrixEventRef[];
  SubCompetitions?: MetrixEventRef[];
  TourResults?: MetrixTourResult[];
  Tracks?: { Number: string; Par: string }[];
  Results?: MetrixResult[];
  WeeklyHC?: MetrixWeeklyHC[];
}

interface MetrixResponse {
  Competition: MetrixCompetition;
}

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content');
const SEASONS_DIR = path.join(CONTENT_DIR, 'metrixSeasons');
const STANDINGS_DIR = path.join(CONTENT_DIR, 'metrixStandings');
const EVENTS_DIR = path.join(CONTENT_DIR, 'metrixEvents');

// Division display order; anything unrecognised sorts last.
const DIVISION_ORDER = ['A', 'B', 'C', 'D', 'X', 'Z'];

async function fetchFromMetrix(id: string): Promise<MetrixResponse> {
  const url = `https://discgolfmetrix.com/api.php?content=result&id=${id}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from Metrix: ${response.statusText}`);
  }
  return response.json();
}

// Metrix names embed the season as an HTML-escaped breadcrumb, e.g.
// "MDGC 2026 Social Days &rarr; 1. Feb West Social Day - Stony Creek".
// Keep only the final segment and decode the arrow.
function cleanEventName(name: string): string {
  const segments = name.split('&rarr;');
  return segments[segments.length - 1].replace(/&rarr;/g, '→').trim();
}

function divisionLetter(className: string): string {
  const match = className.match(/Div\s+([A-Za-z0-9]+)/);
  return match ? match[1].toUpperCase() : '?';
}

function divisionRank(letter: string): number {
  const i = DIVISION_ORDER.indexOf(letter);
  return i === -1 ? DIVISION_ORDER.length : i;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Merge an event's gross scorecard (Results) with the weekly-handicap
// standings (WeeklyHC), grouped into division tables.
function buildDivisions(competition: MetrixCompetition) {
  const results = competition.Results ?? [];
  const weeklyHC = competition.WeeklyHC ?? [];

  const hcByUser = new Map<string, MetrixWeeklyHC>();
  for (const hc of weeklyHC) {
    hcByUser.set(String(hc.UserID), hc);
  }

  const players = results.map((r) => {
    const hc = hcByUser.get(String(r.UserID));
    const holes = r.PlayerResults.map((h) => {
      const result = (h as MetrixPlayerHole)?.Result;
      return result ? Number(result) : null;
    });
    const className = hc?.ClassName ?? '';
    return {
      userId: String(r.UserID),
      name: r.Name,
      group: r.Group ?? null,
      division: className ? divisionLetter(className) : '?',
      divisionName: className || 'Unranked',
      rating: hc?.Rating ?? null,
      holes,
      sum: r.Sum,
      diff: r.Diff,
      hc: hc ? round2(hc.HC) : null,
      net: hc ? round2(hc.Result - hc.HC) : null,
      pos: 0, // assigned per division below
    };
  });

  const byDivision = new Map<string, typeof players>();
  for (const p of players) {
    const list = byDivision.get(p.division) ?? [];
    list.push(p);
    byDivision.set(p.division, list);
  }

  return [...byDivision.entries()]
    .map(([letter, list]) => {
      // Rank by raw score ascending (best first), net as a tie-breaker.
      list.sort((a, b) => {
        if (a.sum !== b.sum) return a.sum - b.sum;
        if (a.net === null) return 1;
        if (b.net === null) return -1;
        return a.net - b.net;
      });
      // Finishing position by raw score, with ties sharing a position.
      list.forEach((p, i) => {
        p.pos = i > 0 && p.sum === list[i - 1].sum ? list[i - 1].pos : i + 1;
      });
      return { letter, name: list[0]?.divisionName ?? letter, players: list };
    })
    .sort((a, b) => divisionRank(a.letter) - divisionRank(b.letter));
}

async function fetchEvent(seasonId: string, eventRef: MetrixEventRef, round: number) {
  const { Competition } = await fetchFromMetrix(eventRef.ID);
  const tracks = (Competition.Tracks ?? []).map((t) => ({
    number: t.Number,
    par: Number(t.Par),
  }));

  const eventFile = {
    id: Number(Competition.ID),
    seasonId: Number(seasonId),
    round,
    name: cleanEventName(Competition.Name),
    date: Competition.Date,
    courseName: Competition.CourseName,
    courseId: Competition.CourseID,
    holeCount: tracks.length,
    par: tracks.reduce((sum, t) => sum + t.par, 0),
    tracks,
    divisions: buildDivisions(Competition),
  };

  // A round counts as played once someone has a recorded score; players may
  // register (and so appear in the results) well before the round is held.
  const played = eventFile.divisions.some((d) => d.players.some((p) => p.sum > 0));

  if (played) {
    fs.writeFileSync(
      path.join(EVENTS_DIR, `${eventFile.id}.json`),
      JSON.stringify(eventFile, null, 2)
    );
  }

  // Raw name/time are preserved for the (unchanged) lightweight season file.
  return { ...eventFile, played, rawName: Competition.Name, time: Competition.Time };
}

async function fetchSeasonData(seasonId: string) {
  for (const dir of [SEASONS_DIR, STANDINGS_DIR, EVENTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { Competition: season } = await fetchFromMetrix(seasonId);
  const events = season.Events || season.SubCompetitions || [];

  const eventsList = [];
  const rounds = [];

  let round = 0;
  for (const event of events) {
    round += 1;
    console.log(`Fetching event ${event.ID}: ${event.Name}...`);
    const eventFile = await fetchEvent(seasonId, event, round);

    eventsList.push({
      id: eventFile.id,
      name: eventFile.rawName,
      date: eventFile.date,
      time: eventFile.time,
      courseName: eventFile.courseName,
      courseId: eventFile.courseId,
    });
    rounds.push({
      id: eventFile.id,
      round,
      name: eventFile.name,
      date: eventFile.date,
      courseName: eventFile.courseName,
      courseId: eventFile.courseId,
      played: eventFile.played,
    });
    console.log(`  Fetched: ${eventFile.name} - ${eventFile.date}`);

    // Small delay to be nice to the API.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Lightweight season file consumed by the events calendar.
  fs.writeFileSync(
    path.join(SEASONS_DIR, `${seasonId}.json`),
    JSON.stringify(
      {
        id: Number(season.ID),
        name: season.Name,
        dateStart: season.TourDateStart,
        dateEnd: season.TourDateEnd,
        eventCount: events.length,
        events: eventsList,
      },
      null,
      2
    )
  );

  // Season standings (Metrix tour points) plus the round list, for the results pages.
  // Metrix's TourResults occasionally repeats a player's row verbatim, so dedupe by user.
  const seenUsers = new Set<string>();
  const standings = (season.TourResults ?? [])
    .filter((r) => {
      const userId = String(r.UserID);
      if (seenUsers.has(userId)) return false;
      seenUsers.add(userId);
      return true;
    })
    .map((r) => ({
      userId: String(r.UserID),
      name: r.Name,
      place: r.Place,
      total: r.Total,
      eventResults: r.EventResults,
    }));

  fs.writeFileSync(
    path.join(STANDINGS_DIR, `${seasonId}.json`),
    JSON.stringify(
      {
        id: Number(season.ID),
        name: season.Name,
        dateStart: season.TourDateStart,
        dateEnd: season.TourDateEnd,
        rounds,
        standings,
      },
      null,
      2
    )
  );

  console.log(
    `\nSaved season ${seasonId}: ${season.Name} (${events.length} events, ${standings.length} season standings)`
  );
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
