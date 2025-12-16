import { defineCollection, z, reference } from 'astro:content';

// Helper for optional fields from Sveltia/Decap CMS.
// The CMS outputs '' for empty optional fields instead of omitting them,
// which breaks Zod validation. This wrapper converts '' to undefined.
const cmsOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' ? undefined : val), schema.optional());

const courses = defineCollection({
  type: 'content',
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
  type: 'content',
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.string().optional(),
    photo: image().optional(),
  }),
});

const discLibraries = defineCollection({
  type: 'data',
  schema: z.object({
    council: z.string(),
    location: z.string(),
    url: z.string(),
  }),
});

// Club events (organised by MDGC)
const events = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.date(),
    endDate: cmsOptional(z.date()),
    courses: z.array(reference('courses')).optional(),
    heroImage: cmsOptional(image()),
    registrationUrl: cmsOptional(z.string().url()),
  }),
});

// External events (not organised by MDGC)
const externalEvents = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    endDate: cmsOptional(z.date()),
    location: z.string(), // e.g. "Geelong, VIC"
    url: z.string().url(), // link to external event page
  }),
});

const metrixSeasons = defineCollection({
  type: 'data',
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

export const collections = {
  courses,
  board,
  discLibraries,
  events,
  externalEvents,
  metrixSeasons,
};
