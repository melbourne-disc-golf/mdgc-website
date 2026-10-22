import { describe, it, expect } from 'vitest';
import { courseForMetrixId, coursesFromSources } from './metrix-courses';

describe('coursesFromSources', () => {
  it('maps each Metrix course id to the course slug and title', () => {
    const courses = coursesFromSources({
      '../content/courses/ruffey-lake.mdx': '---\ntitle: Ruffey Lake\nmetrixCourseIds:\n  - "31614"\n---\nBody',
      '../content/courses/heathdale.mdx':
        "---\ntitle: \"Heathdale Glen Orden\"\nmetrixCourseIds:\n  - '30043'\n  - 46220 # redesign\n---\n",
      '../content/courses/no-metrix.md': '---\ntitle: Elsewhere\n---\n',
    });
    expect(courses.get('31614')).toEqual({ slug: 'ruffey-lake', title: 'Ruffey Lake' });
    expect(courses.get('46220')).toEqual({ slug: 'heathdale', title: 'Heathdale Glen Orden' });
    expect(courses.size).toBe(3);
  });
});

describe('courseForMetrixId', () => {
  it('finds courses in the content collection', () => {
    expect(courseForMetrixId('31614')).toEqual({ slug: 'ruffey-lake', title: 'Ruffey Lake' });
  });

  it('returns undefined for an unknown course', () => {
    expect(courseForMetrixId('0')).toBeUndefined();
  });
});
