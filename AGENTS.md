# Melbourne Disc Golf Club website rebuild

## Project Overview

This is the website for the Melbourne Disc Golf Club (MDGC). It replaced the club's former WordPress site, which was decommissioned in December 2025.

## Project structure

High-level only — explore the tree for specifics, it changes often.

```
src/
├── components/   # reusable Astro components (Header, cards, panels, …)
├── layouts/      # page layouts — Layout.astro is the base (Header + page chrome + footer)
├── pages/        # routes (.astro / .mdx): disc-golf/, club/, courses/, events/, shop, …
├── content/      # content collections (courses, events) + content.config.ts
├── data/         # site data & helpers (navigation.ts)
├── utils/        # build-time helpers (e.g. metrix.ts)
├── scripts/      # client-side scripts
├── styles/       # global.css
└── assets/       # images, icons

old-wordpress-site/  # archived sketch of the former WordPress site (reference)
```

## Former WordPress site

The club's previous website was WordPress-based. It was decommissioned in December 2025, when this site took over https://www.melbournediscgolf.com/.

The [`old-wordpress-site/`](old-wordpress-site/) directory contains a "sketch" of that old site, retained as a content reference.

## Approach

- Use a static site, for runtime simplicity and performance.
- Design should be responsive, mobile-first.
- Use clean, accessible, semantic HTML.
- Make it as easy as possible for non-technical club members to manage content.
  - use Astro components and/or "content collections" for consistency

## UI design language

The site should look and behave like one site, with a common design language, not a collection of individually styled pages.

- Before styling anything new, check [`/design`](src/pages/design.astro), the catalogue of shared components, CSS classes and conventions. Prefer what's there.
- One-off styles are fine if they're used by only one page (or page template).
- A pattern used across pages (or templates) should be factored out into a shared component or class, and documented on `/design`.
- Also:
  - use " - " as the separator in titles, e.g. "Round 5 - Bicentennial Park - Div A";
  - draw charts and bars to scale;
  - prefer simple and plain over clever.

## Writing style

- In headings, use sentence case, not title case.
  - e.g. "What you get" rather than "What You Get"

## Tech stack

- manage website source in Git (on GitHub)
- use [Astro](https://astro.build/) as a static site generator
- use [Tailwind CSS](https://tailwindcss.com/) for styling
- deploy to [Cloudflare Pages](https://pages.cloudflare.com/)
- use Sveltia CMS to manage content of some pages (courses, events)
- use `pnpm` as the package manager (not `npm`)

## Key technical design choices

- **Data is synced, not fetched live.** Scheduled GitHub Actions workflows (`.github/workflows/sync-*.yml`) fetch data that changes (Metrix results, PDGA events) and commit it to the repo, which triggers a rebuild.
- **A website, not an app.** Anything worth linking to gets its own URL (e.g. a page per season, division filter and round). Client-side JavaScript is progressive enhancement: the content must be there without it.
- **Metrix first.** Social day data comes from Disc Golf Metrix wherever possible. Take only what Metrix doesn't have from elsewhere (for now, mdgc-sd, scraped as a stopgap).
- **Match data on IDs, not names.** Match events and players on Metrix IDs. URLs use readable slugs (e.g. `/events/social/seasons/2026-2/rounds/3`), but slugs are only presentation.
- **Don't guess rules the data doesn't hold.** For example, don't hard-code a mapping from groups to tee times, or an event capacity. If the data isn't available, link to where it is.
- **Logic lives in tested modules.** Keep data fetching and computation in plain TypeScript under `src/utils/` (or `src/data/`), and keep `.astro` pages for presentation.

## Site structure

We have structured the new site into these sections:

- **Disc Golf**: information about the sport of disc golf
- **Club**: information about the club, and how it operates
- **Courses**: information on where to play, in Melbourne
- **Events**: information about when to play with others - social days and tournaments
- **Shop**: buying discs etc (link to external shop site)

## Working on this project

Dear agent: when working with humans on this project, please:

- Explain the changes you make: why you decided to do them, and how they work.
- Don't commit changes to Git without checking first.
- Write tests, and run them:
  - Anything that computes, parses or transforms data gets unit tests (Vitest, in a `*.test.ts` file alongside the module). For complex code, write the tests first.
  - Tests should check rules, using small fixtures, not live data that changes every round.
  - Before calling a change done, run `pnpm test`, `pnpm astro check` and `pnpm build`, and fix what they report in code you touched.
  - Check UI changes in a browser, at both desktop and phone widths.
  - Don't delete or weaken a test to make it pass. If a test looks wrong, say so.

## Status

To determine (or update) current status, see:

- the "Project Status" section in the README.md
- GitHub Issues at https://github.com/melbourne-disc-golf/mdgc-website/issues

## Issue tracking

**IMPORTANT**: This project uses GitHub Issues for tracking tasks and bugs.

View and create issues at: https://github.com/melbourne-disc-golf/mdgc-website/issues
