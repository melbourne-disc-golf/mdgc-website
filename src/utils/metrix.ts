// Build-time transforms over the raw Metrix API responses stored in
// src/data/metrix/. The fetch script stores Metrix's responses verbatim; all
// shaping (joining gross scorecards with handicap standings, deriving net and
// position, grouping by division) happens here so we can re-derive freely
// without re-fetching.

import { seasonTitle, socialSeasons } from '../data/social-seasons';
import { courseForMetrixId } from './metrix-courses';

interface RawTrack {
  Number: string;
  Par: string;
}

interface RawPlayerHole {
  Result?: string;
  Diff?: number;
}

interface RawResult {
  UserID: string;
  Name: string;
  Group?: string;
  ClassName?: string;
  PlayerResults: (RawPlayerHole | unknown[])[];
  Sum: number;
  Diff: number;
  Place: number;
}

interface RawWeeklyHC {
  UserID: number;
  Name: string;
  ClassName: string;
  Rating: number;
  Result: number; // gross, matches RawResult.Sum
  HC: number;
}

interface RawCompetition {
  ID: number | string;
  Name: string;
  Date: string;
  CourseName: string;
  CourseID: string;
  TourDateStart?: string;
  TourDateEnd?: string;
  Events?: { ID: string; Name: string }[];
  SubCompetitions?: { ID: string; Name: string }[];
  Tracks?: RawTrack[];
  Results?: RawResult[];
  WeeklyHC?: RawWeeklyHC[];
}

interface RawResponse {
  Competition: RawCompetition;
}

export interface Player {
  userId: string;
  name: string;
  group: string | null;
  division: string;
  divisionName: string;
  rating: number | null;
  holes: (number | null)[];
  sum: number;
  diff: number;
  hc: number | null;
  net: number | null;
  pos: number;
}

export interface Division {
  letter: string;
  name: string;
  label: string; // e.g. "Div A"
  description: string | null; // e.g. "Metrix Rating > 890"
  players: Player[];
}

export interface EventDetail {
  id: number;
  seasonId: number;
  number: number;
  name: string; // as Metrix has it; prefer title
  title: string; // e.g. "Round 8 - Ruffey Lake"
  date: string;
  courseName: string; // as Metrix has it; prefer courseTitle
  courseId: string;
  courseTitle: string; // our course's title, if we know the course
  courseSlug?: string; // our course page, if we know the course
  holeCount: number;
  par: number;
  tracks: { number: string; par: number }[];
  divisions: Division[];
}

export interface SocialDay {
  id: number;
  number: number;
  name: string; // as Metrix has it; prefer title
  title: string; // e.g. "Round 8 - Ruffey Lake"
  date: string;
  courseName: string; // as Metrix has it; prefer courseTitle
  courseId: string;
  courseTitle: string; // our course's title, if we know the course
  courseSlug?: string; // our course page, if we know the course
  played: boolean;
  players: number; // players who played, or (for upcoming social days) registered so far
}

export interface RegisteredPlayer {
  name: string;
  group: string | null;
  division: string;
  divisionName: string;
}

export interface PlayerGroup {
  name: string;
  players: RegisteredPlayer[];
}

export interface UpcomingSocialDay {
  id: number;
  seasonId: number;
  number: number;
  name: string; // as Metrix has it; prefer title
  title: string; // e.g. "Round 8 - Ruffey Lake"
  date: string;
  courseName: string; // as Metrix has it; prefer courseTitle
  courseId: string;
  courseTitle: string; // our course's title, if we know the course
  courseSlug?: string; // our course page, if we know the course
  registeredCount: number;
  registeredByDivision: Record<string, number>; // by division letter, grouped or not
  groups: PlayerGroup[];
}

export interface Season {
  id: number;
  slug: string;
  name: string; // as Metrix has it; prefer title
  title: string; // e.g. "2026 Season 2"
  dateStart?: string;
  dateEnd?: string;
  socialDays: SocialDay[];
}

// Load every raw Metrix response and index it by Metrix ID.
const rawModules = import.meta.glob('../data/metrix/*.json', { eager: true });
const byId = new Map<string, RawCompetition>();
for (const mod of Object.values(rawModules)) {
  const data = ((mod as { default?: RawResponse }).default ?? (mod as RawResponse));
  const comp = data.Competition;
  if (comp) byId.set(String(comp.ID), comp);
}

const DIVISION_ORDER = ['A', 'B', 'C', 'D', 'X', 'Z'];

function divisionLetter(className: string): string {
  const match = className.match(/Div\s+([A-Za-z0-9]+)/);
  return match ? match[1].toUpperCase() : '?';
}

/** Split a Metrix class name like "Div A - Metrix Rating > 890" at its first " - ". */
export function splitDivisionName(name: string): { label: string; description: string | null } {
  const i = name.indexOf(' - ');
  if (i === -1) return { label: name, description: null };
  return { label: name.slice(0, i), description: name.slice(i + 3) };
}

function divisionRank(letter: string): number {
  const i = DIVISION_ORDER.indexOf(letter);
  return i === -1 ? DIVISION_ORDER.length : i;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Metrix names embed the season as an HTML-escaped breadcrumb, e.g.
// "MDGC 2026 Social Days &rarr; 1. Feb West Social Day - Stony Creek".
// Keep only the final segment and decode the arrow.
function cleanEventName(name: string): string {
  const segments = name.split('&rarr;');
  return segments[segments.length - 1].replace(/&rarr;/g, '→').trim();
}

// Our own labels for a round, from its number and course, rather than its
// Metrix name (whose format varies from season to season).
function roundLabels(comp: RawCompetition, number: number) {
  const course = courseForMetrixId(comp.CourseID);
  const courseTitle = course?.title ?? comp.CourseName.split('&rarr;')[0].trim();
  return {
    title: number ? `Round ${number} - ${courseTitle}` : courseTitle,
    courseTitle,
    courseSlug: course?.slug,
  };
}

// A round counts as played once someone has a recorded score; players may
// register (and so appear in the results) before the round is held.
function isPlayed(comp: RawCompetition): boolean {
  return (comp.Results ?? []).some((r) => r.Sum > 0);
}

// Merge a round's gross scorecard (Results) with its handicap standings
// (WeeklyHC, where divisions/ratings live), grouped into division tables.
function buildDivisions(comp: RawCompetition): Division[] {
  const results = comp.Results ?? [];
  const weeklyHC = comp.WeeklyHC ?? [];

  const hcByUser = new Map<string, RawWeeklyHC>();
  for (const hc of weeklyHC) {
    hcByUser.set(String(hc.UserID), hc);
  }

  const players: Player[] = results.map((r) => {
    const hc = hcByUser.get(String(r.UserID));
    const holes = r.PlayerResults.map((h) => {
      const result = (h as RawPlayerHole)?.Result;
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
      pos: 0,
    };
  });

  const byDivision = new Map<string, Player[]>();
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
      const name = list[0]?.divisionName ?? letter;
      return { letter, name, ...splitDivisionName(name), players: list };
    })
    .sort((a, b) => divisionRank(a.letter) - divisionRank(b.letter));
}

function eventChildren(comp: RawCompetition): { ID: string; Name: string }[] {
  return comp.Events || comp.SubCompetitions || [];
}

function buildSocialDay(eventId: string, number: number): SocialDay | null {
  const comp = byId.get(eventId);
  if (!comp) return null;
  return {
    id: Number(comp.ID),
    number,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
    ...roundLabels(comp, number),
    played: isPlayed(comp),
    players: (comp.Results ?? []).length,
  };
}

// Locate the season a social day belongs to, and its 1-based number.
function seasonOf(eventId: string): { season: RawCompetition; number: number } | null {
  for (const comp of byId.values()) {
    if (!eventChildren(comp).length) continue;
    const idx = eventChildren(comp).findIndex((c) => String(c.ID) === String(eventId));
    if (idx !== -1) return { season: comp, number: idx + 1 };
  }
  return null;
}

/** A Metrix competition's page, where players register and results are posted. */
export function metrixUrl(id: number | string): string {
  return `https://discgolfmetrix.com/${id}`;
}

/** All configured seasons that have Metrix data, newest first. */
export function getSeasons(): Season[] {
  const seasons: Season[] = [];
  for (const { metrixId, slug } of socialSeasons) {
    const comp = byId.get(metrixId);
    if (!comp) continue;
    const children = eventChildren(comp);
    if (!children.length) continue;
    const socialDays = children
      .map((c, i) => buildSocialDay(c.ID, i + 1))
      .filter((sd): sd is SocialDay => sd !== null);
    seasons.push({
      id: Number(comp.ID),
      slug,
      name: comp.Name,
      title: seasonTitle(slug),
      dateStart: comp.TourDateStart,
      dateEnd: comp.TourDateEnd,
      socialDays,
    });
  }
  return seasons.sort((a, b) => (b.dateStart ?? '').localeCompare(a.dateStart ?? ''));
}

/** Full results detail (division tables) for a played social day, or null. */
export function getEvent(eventId: string | number): EventDetail | null {
  const comp = byId.get(String(eventId));
  if (!comp || !isPlayed(comp)) return null;

  const tracks = (comp.Tracks ?? []).map((t) => ({ number: t.Number, par: Number(t.Par) }));
  const context = seasonOf(String(eventId));

  return {
    id: Number(comp.ID),
    seasonId: context ? Number(context.season.ID) : Number(comp.ID),
    number: context?.number ?? 0,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
    ...roundLabels(comp, context?.number ?? 0),
    holeCount: tracks.length,
    par: tracks.reduce((sum, t) => sum + t.par, 0),
    tracks,
    divisions: buildDivisions(comp),
  };
}

// Sort helper: numeric group labels ("1", "12") in order, others alphabetically.
function compareGroupNames(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

/** Registration/groups for an upcoming (not-yet-played) social day, or null if unknown. */
export function getUpcomingSocialDay(eventId: string | number): UpcomingSocialDay | null {
  const comp = byId.get(String(eventId));
  if (!comp) return null;

  const players: RegisteredPlayer[] = (comp.Results ?? []).map((r) => {
    const className = r.ClassName ?? '';
    return {
      name: r.Name,
      group: r.Group || null,
      division: className ? divisionLetter(className) : '?',
      divisionName: className || 'Unranked',
    };
  });

  // Bucket registered players by their assigned group (ungrouped are dropped).
  const byGroup = new Map<string, RegisteredPlayer[]>();
  for (const p of players) {
    if (p.group === null) continue;
    const list = byGroup.get(p.group) ?? [];
    list.push(p);
    byGroup.set(p.group, list);
  }

  // Groups are numbered sequentially, but empty ones don't appear in the results
  // data; fill the numeric gaps so they still show. Pad to at least 18 groups
  // (a full social day) once any group exists.
  const numericGroups = [...byGroup.keys()].filter((n) => /^\d+$/.test(n)).map(Number);
  if (numericGroups.length) {
    for (let i = 1; i <= Math.max(18, ...numericGroups); i++) {
      if (!byGroup.has(String(i))) byGroup.set(String(i), []);
    }
  }

  const groups: PlayerGroup[] = [...byGroup.entries()]
    .map(([name, groupPlayers]) => ({ name, players: groupPlayers }))
    .sort((a, b) => compareGroupNames(a.name, b.name));

  const context = seasonOf(String(eventId));

  return {
    id: Number(comp.ID),
    seasonId: context ? Number(context.season.ID) : Number(comp.ID),
    number: context?.number ?? 0,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
    ...roundLabels(comp, context?.number ?? 0),
    registeredCount: players.length,
    registeredByDivision: countBy(players, (p) => p.division),
    groups,
  };
}
