// Active-state helpers for navigation links.

// Is the current page at or under a nav item?
export function isActiveNavItem(currentPath: string, itemHref: string): boolean {
  if (itemHref === '/' && currentPath === '/') return true;
  if (itemHref !== '/' && currentPath.startsWith(itemHref)) return true;
  return false;
}

// Text colour class for a nav link, based on active state.
export function navItemColor(currentPath: string, itemHref: string): string {
  return isActiveNavItem(currentPath, itemHref) ? 'text-white' : 'text-mdgc-blue-light';
}
