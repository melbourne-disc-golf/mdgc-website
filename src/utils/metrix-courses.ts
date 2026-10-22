// Our courses, indexed by their Disc Golf Metrix course ids.
//
// Reads the course content files' frontmatter directly (rather than through
// astro:content), so plain build-time modules like metrix.ts can use it, and
// it works under vitest.

import { parse } from 'yaml';

export interface CourseRef {
  slug: string;
  title: string;
}

interface CourseFrontmatter {
  title?: string;
  metrixCourseIds?: (string | number)[];
}

function frontmatter(source: string): CourseFrontmatter {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? ((parse(match[1]) as CourseFrontmatter | null) ?? {}) : {};
}

/** Index course sources (path → raw file contents) by Metrix course id. */
export function coursesFromSources(sources: Record<string, string>): Map<string, CourseRef> {
  const byMetrixId = new Map<string, CourseRef>();
  for (const [path, source] of Object.entries(sources)) {
    const slug = path.replace(/^.*\//, '').replace(/\.mdx?$/, '');
    const { title, metrixCourseIds } = frontmatter(source);
    if (!title) continue;
    for (const id of metrixCourseIds ?? []) {
      byMetrixId.set(String(id), { slug, title });
    }
  }
  return byMetrixId;
}

const courses = coursesFromSources(
  import.meta.glob('../content/courses/*.{md,mdx}', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
);

export function courseForMetrixId(metrixCourseId: string): CourseRef | undefined {
  return courses.get(metrixCourseId);
}
