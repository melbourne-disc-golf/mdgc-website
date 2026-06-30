# Sveltia CMS

The site uses [Sveltia CMS](https://github.com/sveltia/sveltia-cms) — a modern, Git-backed headless CMS — to manage the content of some pages (courses, events, and a few editable fragments). It replaced [Decap CMS](https://decapcms.org), which the site originally used.

## What it is

Sveltia CMS is a lightweight rewrite of Netlify/Decap CMS, designed as a drop-in replacement. It reads the same `config.yml` format Decap used, so the migration was essentially a script-tag swap.

## Why we chose it over Decap

- **Performance**: built with Svelte; bundle under 500 KB (vs ~1.5 MB for Decap), with faster content fetching via GraphQL.
- **User experience**: modern, full-viewport interface, dark mode, and mobile/tablet support with drag-and-drop uploads.
- **Maintenance**: actively developed, and resolves a large backlog of long-standing Decap issues.

## How it's wired up

- `public/cms/sveltia.html` loads Sveltia from a CDN and points it at `public/cms/config.yml`.
- `public/cms/index.html` redirects `/cms` to the Sveltia page.
- A small dev-server middleware in `astro.config.mjs` rewrites `/cms/sveltia` to `/cms/sveltia.html` so the extensionless URL works.
- Backend is GitHub (`config.yml`), committing directly to `main`.

Access the CMS in production at https://mdgc.pages.dev/cms.

## Image path handling (resolved)

Sveltia had a bug where a `public_folder` of `~/assets/images` gained an extra leading `/` when replacing images (`/~/assets/images/...`), breaking Astro's image imports. We avoid it by keeping `public_folder` off the `~` prefix — see `public/cms/config.yml`.

## Known limitations

- **Subfolder navigation**: media-library subfolder browsing landed in Sveltia 2.0 (early 2026).
