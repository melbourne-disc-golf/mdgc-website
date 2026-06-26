import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

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
    featured: z.boolean().optional().default(false),
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

// External events (not organised by MDGC)
const externalEvents = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/externalEvents' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    endDate: cmsOptional(z.date()),
    location: z.string(), // e.g. "Geelong, VIC"
    url: z.string().url(), // link to external event page
  }),
});

const metrixSeasons = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/metrixSeasons' }),
  schema: z.object({
    id: z.number(),
    name: z.string(),
    dateStart: z.string(),
    dateEnd: z.string(),
    eventCount: z.number(),
    events: z.array(z.object({
      id: z.number(),
      name: z.string(),
      date: z.string(),
      time: z.string(),
      courseName: z.string(),
      courseId: z.string(),
    })),
  }),
});

// Season standings (Metrix tour points) plus the round list, for the results pages.
const metrixStandings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/metrixStandings' }),
  schema: z.object({
    id: z.number(),
    name: z.string(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    rounds: z.array(z.object({
      id: z.number(),
      round: z.number(),
      name: z.string(),
      date: z.string(),
      courseName: z.string(),
      courseId: z.string(),
      played: z.boolean(),
    })),
    standings: z.array(z.object({
      userId: z.string(),
      name: z.string(),
      place: z.number(),
      total: z.number(),
      eventResults: z.array(z.number().nullable()),
    })),
  }),
});

// Per-round results: gross scorecards merged with handicap standings, grouped by division.
const metrixEvents = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/metrixEvents' }),
  schema: z.object({
    id: z.number(),
    seasonId: z.number(),
    round: z.number(),
    name: z.string(),
    date: z.string(),
    courseName: z.string(),
    courseId: z.string(),
    holeCount: z.number(),
    par: z.number(),
    tracks: z.array(z.object({
      number: z.string(),
      par: z.number(),
    })),
    divisions: z.array(z.object({
      letter: z.string(),
      name: z.string(),
      players: z.array(z.object({
        userId: z.string(),
        name: z.string(),
        group: z.string().nullable(),
        division: z.string(),
        divisionName: z.string(),
        rating: z.number().nullable(),
        holes: z.array(z.number().nullable()),
        sum: z.number(),
        diff: z.number(),
        hc: z.number().nullable(),
        net: z.number().nullable(),
        pos: z.number(),
      })),
    })),
  }),
});

export const collections = {
  courses,
  board,
  discLibraries,
  events,
  externalEvents,
  metrixSeasons,
  metrixStandings,
  metrixEvents,
};
