import { getCollection } from 'astro:content';

export interface NavSubPage {
  title: string;
  href: string;
  description?: string;
  icon?: string;
}

export interface NavItem {
  title: string;
  href: string;
  description?: string;
  icon?: string;
  image?: string;
  subPages?: NavSubPage[];
}

async function getCourseNavItems(): Promise<NavSubPage[]> {
  let courses = await getCollection('courses');

  courses = courses.filter(course => course.data.featured);
  courses.sort((a, b) => a.data.title.localeCompare(b.data.title));

  return courses.map(course => ({
    title: course.data.title,
    href: `/courses/${course.slug}`
  }));
}

export async function getNavItems(featuredCoursesOnly: boolean = false): Promise<NavItem[]> {
  const courseSubPages = await getCourseNavItems();

  return [
    {
      title: 'Disc Golf',
      href: '/disc-golf',
      description: 'about the game',
      icon: 'basket',
      subPages: [
        { title: 'Try it', href: '/disc-golf/try', description: 'how to get started', icon: 'heroicons:rocket-launch' },
        { title: 'Get into it', href: '/disc-golf/grow', description: 'grow your game', icon: 'heroicons:arrow-trending-up' }
      ]
    },
    {
      title: 'Club',
      href: '/club',
      description: 'about us',
      icon: 'heroicons:users',
      subPages: [
        { title: 'News', href: '/club/news', description: 'latest updates', icon: 'heroicons:newspaper' },
        { title: 'Membership', href: '/club/membership', description: 'join us!', icon: 'heroicons:users' },
        { title: 'Board', href: '/club/board', description: 'meet the team', icon: 'heroicons:user-group' }
      ]
    },
    {
      title: 'Courses',
      href: '/courses',
      description: 'where to play',
      icon: 'heroicons:map-pin',
      subPages: courseSubPages
    },
    {
      title: 'Events',
      href: '/events',
      description: 'what is happening',
      icon: 'heroicons:calendar',
      subPages: [
        { title: 'Social Days', href: '/events/social', description: 'our regular meetups', icon: 'heroicons:heart' },
        { title: 'Tournaments', href: '/events/tournaments', description: 'compete!', icon: 'heroicons:trophy' },
        { title: 'Summer Cup', href: '/events/summer-cup', description: 'tournament series', icon: 'heroicons:sun' }
      ]
    },
    {
      title: 'Shop',
      href: '/shop',
      description: 'buy discs, and more!',
      icon: 'heroicons:shopping-cart'
    }
  ];
}