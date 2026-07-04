// URLs of external sites the website links to, kept in one place so each lives
// once (e.g. the /shop and /ctb redirects in astro.config.mjs share these).
// `as const` makes it a typesafe dictionary: keys and exact URLs are literal types.
export const externalUrls = {
  shop: 'https://mdgcshop.square.site/',
  ctb: 'https://docs.google.com/forms/d/1qG5hbu89CphfQhYTAXnmCRAqe84S5EgCChU908jlZTQ',
  metrixSocialDays: 'https://discgolfmetrix.com/?u=club_events&id=235',
  metrixScoringRules: 'https://discgolfmetrix.com/?u=rule&ID=6',
  metrixFavicon: 'https://discgolfmetrix.com/assets/img/favicon.png',
} as const;
