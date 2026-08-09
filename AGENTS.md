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
- For complex (but testable) code, write tests first.

## Status

To determine (or update) current status, see:

- the "Project Status" section in the README.md
- GitHub Issues at https://github.com/melbourne-disc-golf/mdgc-website/issues

## Issue tracking

**IMPORTANT**: This project uses GitHub Issues for tracking tasks and bugs.

View and create issues at: https://github.com/melbourne-disc-golf/mdgc-website/issues
