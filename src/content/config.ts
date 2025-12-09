import { defineCollection, z, reference } from 'astro:content';

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

const events = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    eventType: z.enum(['tournament', 'come-and-try', 'other']),
    date: z.date(),
    endDate: z.date().optional(),
    courses: z.array(reference('courses')).optional(), // optional for external events
    heroImage: image().optional(),
    // For external events (not organised by MDGC)
    external: z.boolean().optional(),
    location: z.string().optional(), // e.g. "Geelong, VIC" - required for external events
    url: z.string().optional(), // link to external event page
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
  metrixSeasons,
};
