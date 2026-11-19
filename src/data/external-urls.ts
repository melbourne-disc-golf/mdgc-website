// URLs of external sites the website links to, kept in one place so each lives
// once (e.g. the /shop redirect in astro.config.mjs shares these).
// `as const` makes it a typesafe dictionary: keys and exact URLs are literal types.
export const externalUrls = {
  shop: 'https://mdgcshop.square.site/',
  metrixSocialDays: 'https://discgolfmetrix.com/?u=club_events&id=235',
  metrixScoringRules: 'https://discgolfmetrix.com/?u=rule&ID=6',
  metrixFavicon: '/images/logos/metrix-favicon.png',
} as const;
