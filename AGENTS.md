# Melbourne Disc Golf Club website rebuild

## Project Overview

This project involves building a new modern website for the Melbourne Disc Golf Club (MDGC) to replace their existing WordPress site.

## Project Structure
```
website/
├── src/
│   ├── components/
│   │   ├── Navigation.astro    # Main navigation with dropdowns
│   │   ├── BoardMember.astro   # Board member profile component
│   │   ├── Course.astro        # Course information component
│   │   └── Welcome.astro       # Welcome section component
│   ├── layouts/
│   │   └── Layout.astro        # Base layout template
│   ├── pages/
│   │   ├── index.astro         # Homepage with hero section
│   │   ├── disc-golf/
│   │   │   ├── index.astro     # What is Disc Golf?
│   │   │   └── new-players.astro # New Player Essentials
│   │   ├── courses/
│   │   │   ├── index.astro     # Melbourne courses
│   │   │   ├── victoria.astro  # Other Victorian courses
│   │   │   └── australia.astro # Australia & overseas
│   │   ├── club/
│   │   │   ├── index.astro     # About MDGC
│   │   │   ├── membership.astro # Membership information
│   │   │   ├── contact.astro   # Contact details
│   │   │   └── board.astro     # Board member profiles
│   │   ├── events/
│   │   │   └── index.astro     # Social days and events
│   │   └── shop.astro          # Equipment and merchandise
│   └── styles/
│       └── global.css
└── existing-site/              # Documentation of original site (reference)
    ├── _navbar.md              # Original navigation structure
    ├── index.md                # Original homepage content
    ├── about/, melbourne-courses/, events/, media/
```

## Existing site

The existing (Wordpress-based) website is hosted at https://www.melbournediscgolf.com/.

The [`existing-site/`](existing-site/) directory contains a "sketch" of that existing site, including key content.

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
- use Decap CMS to manage content of some pages (courses, events)
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
