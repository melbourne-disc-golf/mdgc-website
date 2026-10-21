# Social Days integration plan

We plan to bring the public Social Days pages from [mdgc-sd.vercel.app](https://mdgc-sd.vercel.app/) onto melbournediscgolf.com, building them from [Disc Golf Metrix](https://discgolfmetrix.com/) data wherever possible. Zach ([@zschloeffel-png](https://github.com/zschloeffel-png)) built and runs mdgc-sd; it will publish the few pieces Metrix doesn't have as JSON. The operational side (volunteer pages, CTB form updates, prize review) stays on mdgc-sd for now, and moves to club-owned Cloudflare services later.

| Document | Covers |
|---|---|
| This README | Goals, constraints, decisions, phases, open questions |
| [current-state.md](current-state.md) | What each site has today, and the gaps |
| [data-contract.md](data-contract.md) | The JSON that mdgc-sd publishes for this site |

## Goals

- **One namespace.** Everything a player or club member looks at lives under melbournediscgolf.com.
- **Metrix first.** Source as much as possible from Metrix directly; fetch only the rest from mdgc-sd.
- **Club-owned data.** In the long run, no club data should live in accounts the club doesn't own (personal Google accounts, forms, sheets, Vercel projects).

## Constraints

- **A website, not a single-page app.** mdgc-sd presents a season's results as tabs on one page. Here, each season, social day and stats view is its own page, with its own URL, rendered at build time. Interactivity (sorting, filtering) is progressive enhancement on top of HTML that works without it.
- **One look and feel.** The social pages are much more data-heavy than the rest of the site, but should still look like it. Dense tables, score colours and stat cards become shared components with documented styles (on [`/design`](https://www.melbournediscgolf.com/design)), not per-page styling.
- **Static for now.** The site stays a static build on Cloudflare Pages. The existing twice-daily Metrix sync keeps it fresh.

## Decisions

- **Rebuild, don't port.** The pages under `/events/social/seasons/` (built from raw Metrix data) are the foundation. The July port of mdgc-sd's results pages under `/events/social/results/` will be removed once the seasons pages have the same features.
- **Prize winners come from mdgc-sd.** Official prizes depend on CTB (closest-to-basket) entries and a human approval step, so we display what mdgc-sd publishes rather than recomputing them. Two sources of truth would drift.
- **mdgc-sd publishes JSON on its public site.** Its repository is private, so this site fetches JSON files from `mdgc-sd.vercel.app` rather than reading the repository. See [data-contract.md](data-contract.md).
- **Everything is keyed by Metrix ID** (season, social day, player), not by labels like `s2` or `rd-01`, so data survives season rollover.

## Where the data comes from

| Need | Source |
|---|---|
| Scores, hole-by-hole results, positions, ratings | Metrix (already archived in [`src/data/metrix/`](../../src/data/metrix/)) |
| Each player's division in each round | Metrix: `ClassName` in each round's handicap results |
| Handicaps, net scores, handicap leaders | Metrix: each round's handicap results (`WeeklyHC`) |
| Season ladder points | Metrix: the season's `TourResults` |
| Registrations and groups for upcoming rounds | Metrix |
| Season stats | Derived from the Metrix archive |
| Club Champs qualification ladder | Metrix ladder and division history, plus rules from mdgc-sd |
| Official prize winners and prize notes | mdgc-sd |
| Round logistics: organiser, meeting point, cancellations | mdgc-sd |
| Club Champs rules: places, overrides | mdgc-sd |

The Metrix API only serves competitions less than about a year old. The archive committed to this repository is therefore the long-term record: 2026 Season 1 will drop out of the API in early 2027, but stays here.

## Phases

Tracked in [#29](https://github.com/melbourne-disc-golf/mdgc-website/issues/29). Each item will become a sub-issue.

### Foundations

1. **Make the social pages testable.** Pass "today" into page logic rather than reading the clock inside pages. Move logic out of `.astro` pages into functions or components that take data as arguments. Add a small fixture data set: a played round, an upcoming round, ties, an empty division, a cancelled round.
2. **Unit tests** (Vitest) for the Metrix data shaping in [`src/utils/metrix.ts`](../../src/utils/metrix.ts): positions and ties, net scores, division grouping, played versus upcoming, season bucketing (current, next, previous).
3. **Render tests.** Render components with fixture data using Astro's Container API, and assert on the HTML with `node-html-parser` (already a dev dependency).
4. **Browser tests** (Playwright) against a preview build: key pages load, sortable tables sort, filters filter.
5. **Style regression tests.** Screenshot comparisons of a few representative pages (a prose page, a season page, a social day page, a stats page) at mobile and desktop widths. These must run against fixture data, or mask data regions, or they will fail on every data sync.
6. **CI.** A GitHub Actions workflow that runs the tests on pull requests. The automated data-sync commits should run only the cheap checks.
7. **Shared components for data-heavy pages,** shown on `/design`: a data table with a sticky first column and horizontal scrolling on small screens, score colours, podium badges, stat cards, filter chips.

### Data

8. **Extend the Metrix layer** with handicap leaders, per-player division history and the season ladder.
9. **Sync from mdgc-sd.** Agree the [data contract](data-contract.md) with Zach. Extend the scheduled sync to fetch the mdgc-sd JSON and commit it alongside the Metrix data.

### Results

10. **Social day pages reach parity** with mdgc-sd: prize winners and notes, handicap leaders, logistics for upcoming rounds, cancelled rounds shown as cancelled, course names linked to course pages. Remove the hand-maintained [`src/data/social-prize-winners.ts`](../../src/data/social-prize-winners.ts).

### Stats

11. **Season stats page** at `/events/social/seasons/<season>/stats`: season snapshot, scoring mix, attendance, best rounds, prize counts, round difficulty, player scoring profiles. Plain tables first; division and days-played filters as progressive enhancement.

### Club Champs

12. **Qualification ladder,** built here from Metrix data plus the rules mdgc-sd publishes, shown with (or linked from) the [Club Champs event page](https://www.melbournediscgolf.com/events/2026-11-22-club-champs). Per-division tables, with a "find a player" filter. mdgc-sd's forecast simulation is out of scope at first. Before switching over, check the ladder matches mdgc-sd's.

### Content

13. **Social Day info.** Merge the useful parts of mdgc-sd's info page (how handicaps work, etiquette) into [`/events/social`](https://www.melbournediscgolf.com/events/social), as content club members can edit in the CMS.

### Launch

14. **Link the pages** from `/events/social`, and possibly the main navigation.
15. **Remove the old port** (`/events/social/results/`, `SocialResultsBrowser`, `SocialResultsStats`, `src/data/social-results/`) and add redirects from its URLs.
16. **Point mdgc-sd's public results, stats and Club Champs pages** at this site.

## Later: operations

Once the public pages are here, move the operational side off mdgc-sd and off personally owned accounts. That covers volunteer round pages, CTB form updates, prize review and approval, and season setup.

The likely shape is a separate "ops" web app on a melbournediscgolf.com subdomain or path, using Cloudflare services on club-owned accounts:

- storage in D1, KV or R2, replacing Google Sheets, Google Forms responses and Apps Script properties
- Cloudflare Access for sign-in, rather than unguessable links
- Cron Triggers in place of the Apps Script timer
- Cloudflare Email Sending for coordinator and volunteer emails

The club's shop admin app (`mdgc-shopkeeper`) is already planning the same stack: Astro on Cloudflare Workers, Access in front of protected pages, secrets held only in Cloudflare. The ops app should follow the same patterns; it may even be the same app. That decision can wait until the ops work starts.

Once ops publishes from Cloudflare, only the URLs in the data contract change.

## Open questions

- **Club Champs for 2026.** Build the ladder here before 22 November, or show mdgc-sd's ladder until after the event?
- **Female players list.** The Club Champs rules include a list of players, which is personal data. Is it OK to publish, or should the ladder stay on mdgc-sd?
- **URLs.** Keep Metrix IDs in URLs (`/events/social/seasons/3647062/events/3647171`), or move to readable slugs (`/events/social/seasons/2026-s2/rd-01`)? Easier to decide before launch.
- **Freshness.** Should publishing prizes trigger an immediate rebuild (a Cloudflare deploy hook), or is the twice-daily sync enough?
- **Style regression tests.** Worth the maintenance, or are render and browser tests enough?
- **Ownership.** Which accounts own the CTB form, response sheets, roster sheet and mailer today, and can they move to club accounts before the ops work starts?
