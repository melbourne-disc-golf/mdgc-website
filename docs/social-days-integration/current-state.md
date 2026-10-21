# Current state

What each site offers as of October 2026, where mdgc-sd keeps the data that doesn't come from Metrix, and what this site is missing. Part of the [Social Days integration plan](README.md).

## mdgc-sd

[mdgc-sd.vercel.app](https://mdgc-sd.vercel.app/) is built by a Node script from a private repository, and deployed on Vercel. GitHub Actions workflows and Google Apps Script automate the weekly cycle and commit data back to the repository; each commit redeploys the site.

### Public pages

| Page | Content |
|---|---|
| Season results | One page per season, with a tab per round. Each round has prize winners, then a results table per division (position, name, rating, hole-by-hole scores, raw score, handicap, net). |
| Season stats | Season snapshot, scoring mix, attendance, best to-par rounds, prize count board, round difficulty, player scoring profiles. Filterable by division and by days played (3+, 5+, all). |
| Club Champs qualification | A client-side app: per-division qualification ladder, "find a player", remaining social days, and a forecast of where the qualification lines will fall. |
| Social Day info | Divisions, prizes, how Metrix handicaps work, safety and etiquette. |
| Volunteer instructions | Rules and prizes, small-division merges, prize close-out, what the player email and players' meeting must cover, Metrix night-before steps. |

### Operational features

- **Volunteer round pages**, reached by private links: a checklist for each round (early week, night before, on the day, afterwards), message and email templates, and a button that updates the CTB form's hole labels.
- **Coordinator pages**, built only locally, not deployed.
- **Weekly automation:** night-before ratings reminder and division check; event-day closeout that downloads results from Metrix, reads CTB form entries, works out prize winners, and emails a coordinator for approval; on approval, it publishes the prizes, refreshes the Club Champs ladder, and sends social media graphics.
- **Season setup:** browser automation that creates a season's events in Metrix.

### Where mdgc-sd keeps data that isn't in Metrix

| Data | Where |
|---|---|
| Season settings and per-round logistics (organiser, meeting point, notes, cancelled) | JSON committed to the repository, synced daily from a Google Sheet |
| Prize winners and prize notes | JSON committed to the repository by the approved closeout |
| Manual prize corrections | JSON committed to the repository |
| Club Champs rules and overrides | JSON committed to the repository |
| Club Champs ladder | JSON committed to the repository (derived from Metrix and the rules) |
| Each player's division in each round | JSON committed to the repository (derived from Metrix; some rounds were never captured) |
| CTB entries | Google Form responses |
| U18 parent consent | Google Form responses (never published) |
| Approval and reminder state | Apps Script properties |
| Review receipts, closeout reports, prize email drafts, graphics | GitHub Actions artifacts (kept 14 to 90 days) |
| Metrix exports, saved results pages, setup credentials | A maintainer's laptop |

The Google, Vercel and GitHub accounts involved are personal accounts, not club accounts.

## This site

| Page | Content |
|---|---|
| [`/events/social`](https://www.melbournediscgolf.com/events/social/) | What Social Days are, when and where, registering, scoring, divisions and ratings, prizes, Club Champs |
| [`/events/social/seasons`](https://www.melbournediscgolf.com/events/social/seasons/) | Seasons, bucketed into current, next and previous |
| `/events/social/seasons/<season>` | The season's social days: number, date, course, player count |
| `/events/social/seasons/<season>/events/<event>` | Before the day: registered players and groups. Afterwards: a results table per division with hole-by-hole scores, coloured relative to par |
| `/events/social/results/…` | A July 2026 port of mdgc-sd's results and stats pages, using a data snapshot from then |
| [Club Champs 2026](https://www.melbournediscgolf.com/events/2026-11-22-club-champs/) | Schedule, venues, how to qualify, projected field caps |

The seasons pages are live but not linked from anywhere; the links to them and to the `results` port are commented out in [`src/pages/events/social/index.mdx`](../../src/pages/events/social/index.mdx).

Data comes from a scheduled workflow ([`sync-metrix.yml`](../../.github/workflows/sync-metrix.yml)) that fetches every season and social day from the Metrix API twice a day and commits the raw responses to [`src/data/metrix/`](../../src/data/metrix/). [`src/utils/metrix.ts`](../../src/utils/metrix.ts) shapes them at build time.

Prize winners exist for one social day only, typed by hand into [`src/data/social-prize-winners.ts`](../../src/data/social-prize-winners.ts).

Tests cover only the PDGA event import. No workflow runs them on pull requests.

## Gaps

| Feature | Gap |
|---|---|
| Prize winners and notes for every round | Needs the mdgc-sd data feed |
| Handicap leaders per division | Small; data is in Metrix |
| Logistics for upcoming rounds (organiser, meeting point) | Needs the mdgc-sd data feed |
| Cancelled rounds | Needs the mdgc-sd data feed |
| Course names linked to course pages | Small |
| Season stats | Large; a new page per season |
| Club Champs qualification ladder | Large; needs the rules from mdgc-sd |
| How handicaps work, etiquette | Content to merge into `/events/social` |
| Discoverability | Link the seasons pages from `/events/social` and the menu |

Out of scope for now: everything under "operational features" above.
