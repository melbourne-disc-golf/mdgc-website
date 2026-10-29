// Page titles: the page's own title, then its parent's (the back-link), e.g.
// "Qualification | MDGC Club Champs 2026". The HTML <title> adds the site name;
// og:title doesn't, as og:site_name carries it.

export const SITE_NAME = 'Melbourne Disc Golf Club';

/** A page's title with its parent's, unless the title already includes it. */
export function pageTitleWithParent(title: string, parentTitle?: string): string {
  if (!parentTitle || title.includes(parentTitle)) return title;
  return `${title} | ${parentTitle}`;
}

/** The HTML <title>: the page title, then the site name. */
export function documentTitle(pageTitle: string): string {
  return `${pageTitle} | ${SITE_NAME}`;
}
