// Build-time transforms over the raw Metrix API responses stored in
// src/data/metrix/. The fetch script stores Metrix's responses verbatim; all
// shaping (joining gross scorecards with handicap standings, deriving net and
// position, grouping by division) happens here so we can re-derive freely
// without re-fetching.

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
  players: Player[];
}

export interface EventDetail {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  date: string;
  courseName: string;
  courseId: string;
  holeCount: number;
  par: number;
  tracks: { number: string; par: number }[];
  divisions: Division[];
}

export interface Round {
  id: number;
  round: number;
  name: string;
  date: string;
  courseName: string;
  courseId: string;
  played: boolean;
  players: number; // players who played, or (for upcoming rounds) registered so far
}

export interface RegisteredPlayer {
  name: string;
  group: string | null;
  division: string;
  divisionName: string;
}

export interface RoundGroup {
  name: string;
  players: RegisteredPlayer[];
}

export interface UpcomingRound {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  date: string;
  courseName: string;
  courseId: string;
  registeredCount: number;
  groups: RoundGroup[];
}

export interface Season {
  id: number;
  name: string;
  dateStart?: string;
  dateEnd?: string;
  rounds: Round[];
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
      return { letter, name: list[0]?.divisionName ?? letter, players: list };
    })
    .sort((a, b) => divisionRank(a.letter) - divisionRank(b.letter));
}

function eventChildren(comp: RawCompetition): { ID: string; Name: string }[] {
  return comp.Events || comp.SubCompetitions || [];
}

function buildRound(eventId: string, round: number): Round | null {
  const comp = byId.get(eventId);
  if (!comp) return null;
  return {
    id: Number(comp.ID),
    round,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
    played: isPlayed(comp),
    players: (comp.Results ?? []).length,
  };
}

// Locate the season a round belongs to, and its 1-based round number.
function seasonOf(eventId: string): { season: RawCompetition; round: number } | null {
  for (const comp of byId.values()) {
    if (!eventChildren(comp).length) continue;
    const idx = eventChildren(comp).findIndex((c) => String(c.ID) === String(eventId));
    if (idx !== -1) return { season: comp, round: idx + 1 };
  }
  return null;
}

/** All seasons (tour competitions), newest first. */
export function getSeasons(): Season[] {
  const seasons: Season[] = [];
  for (const comp of byId.values()) {
    const children = eventChildren(comp);
    if (!children.length) continue;
    const rounds = children
      .map((c, i) => buildRound(c.ID, i + 1))
      .filter((r): r is Round => r !== null);
    seasons.push({
      id: Number(comp.ID),
      name: comp.Name,
      dateStart: comp.TourDateStart,
      dateEnd: comp.TourDateEnd,
      rounds,
    });
  }
  return seasons.sort((a, b) => (b.dateStart ?? '').localeCompare(a.dateStart ?? ''));
}

/** Every round across all seasons, flattened — for the events calendar. */
export function getSocialDays(): Round[] {
  return getSeasons().flatMap((season) => season.rounds);
}

/** {seasonId, eventId} for every round across all seasons. */
export function getRoundRefs(): { seasonId: number; eventId: number }[] {
  const refs: { seasonId: number; eventId: number }[] = [];
  for (const season of getSeasons()) {
    for (const round of season.rounds) {
      refs.push({ seasonId: season.id, eventId: round.id });
    }
  }
  return refs;
}

/** Full per-round detail (division tables), or null if unknown/unplayed. */
export function getEvent(eventId: string | number): EventDetail | null {
  const comp = byId.get(String(eventId));
  if (!comp || !isPlayed(comp)) return null;

  const tracks = (comp.Tracks ?? []).map((t) => ({ number: t.Number, par: Number(t.Par) }));
  const context = seasonOf(String(eventId));

  return {
    id: Number(comp.ID),
    seasonId: context ? Number(context.season.ID) : Number(comp.ID),
    round: context?.round ?? 0,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
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

/** Registration/groups for an upcoming (not-yet-played) round, or null if unknown. */
export function getUpcomingRound(eventId: string | number): UpcomingRound | null {
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

  const groups: RoundGroup[] = [...byGroup.entries()]
    .map(([name, groupPlayers]) => ({ name, players: groupPlayers }))
    .sort((a, b) => compareGroupNames(a.name, b.name));

  const context = seasonOf(String(eventId));

  return {
    id: Number(comp.ID),
    seasonId: context ? Number(context.season.ID) : Number(comp.ID),
    round: context?.round ?? 0,
    name: cleanEventName(comp.Name),
    date: comp.Date,
    courseName: comp.CourseName,
    courseId: comp.CourseID,
    registeredCount: players.length,
    groups,
  };
}
