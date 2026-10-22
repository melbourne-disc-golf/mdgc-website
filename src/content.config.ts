import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { zoneSlugs } from './data/zones';
import { ctbOverlaps } from './utils/ctb';

// Helper for optional fields from Sveltia/Decap CMS.
// The CMS outputs '' or null for empty optional fields instead of omitting them,
// which breaks Zod validation. This wrapper converts '' and null to undefined.
const cmsOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' || val === null ? undefined : val), schema.optional());

const courses = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/courses' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    suburb: z.string(),
    mainImage: image(),
    thumbnail: image().optional(),
    location: z.string().optional(), // GeoJSON string from map widget
    googleMapsUrl: z.string().optional(), // Google Maps place link (e.g. https://maps.app.goo.gl/...)
    courseMap: image().optional(),
    udiscUrl: z.string().optional(),
    zone: cmsOptional(z.enum(zoneSlugs as [string, ...string[]])), // social-day zone — marks a "main" course; see src/data/zones.ts
    temporary: z.boolean().optional().default(false), // temporary/event course — has a page, but hidden from the courses list

    discLibrary: reference('discLibraries').optional(),
    metrixCourseIds: z.array(z.string()).optional(), // Disc Golf Metrix course IDs (for linking social days)
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/board' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.string().optional(),
    photo: image().optional(),
  }),
});

const discLibraries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/discLibraries' }),
  schema: z.object({
    council: z.string(),
    location: z.string(),
    url: z.string(),
  }),
});

// Club events (organised by MDGC)
const events = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/events' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    aliases: cmsOptional(z.string().transform(s => s.split(/[\s,]+/).filter(Boolean))),
    draft: z.boolean().optional(),
    date: z.date(),
    endDate: cmsOptional(z.date()),
    courses: z.array(reference('courses')).optional(),
    heroImage: cmsOptional(image()),
    registrationUrl: cmsOptional(z.string().url()),
    pdgaEventId: cmsOptional(z.string().regex(/^\d{5,6}$/, 'PDGA Event ID must be 5-6 digits')),
  }),
});

// Note: neither Metrix data (social days, scorecards, standings) nor external
// PDGA events are content collections. Both are stored as data under src/data/
// and shaped at build time — Metrix by src/utils/metrix.ts (fetched by
// scripts/fetch-metrix-data.ts), external events by src/utils/pdga.ts (scraped
// by scripts/fetch-pdga-events.ts).

// Social day info that Metrix doesn't hold: one file per round, named by its
// Metrix ID. Entries are minted from Metrix data, then filled in via the CMS.
// Season, title and date are copies, for the CMS's benefit; pages use Metrix's.
const yamlDate = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString().slice(0, 10) : val),
  z.string(),
);

const ctbPrize = z.object({
  hole: cmsOptional(z.number().int().min(1)),
  divisions: z.array(z.string()).min(1),
});

const socialDays = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/social-days' }),
  schema: z.object({
    season: z.string(),
    title: z.string(),
    date: yamlDate,
    coordinators: cmsOptional(z.array(z.string())),
    ctb: cmsOptional(z.array(ctbPrize).superRefine((prizes, ctx) => {
      const overlaps = ctbOverlaps(prizes);
      if (overlaps.length) {
        ctx.addIssue({
          code: 'custom',
          message: `CTB prizes overlap: Div ${overlaps.join(', ')} ${overlaps.length === 1 ? 'is' : 'are'} in more than one prize`,
        });
      }
    })),
  }),
});

export const collections = {
  courses,
  board,
  discLibraries,
  events,
  socialDays,
};
