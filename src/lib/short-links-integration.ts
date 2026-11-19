import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { AstroIntegration } from 'astro';
import { findConflicts, parseShortLinks, redirectSources, renderRedirects } from '../utils/short-links.ts';

// Adds the CMS-managed short links in src/data/short-links.yml to the
// Cloudflare Pages _redirects file, failing the build if one clashes with a
// hard-coded redirect or an existing page. In dev, serves them directly.
export function shortLinks(): AstroIntegration {
  let root: URL;
  const shortLinksFile = () => new URL('src/data/short-links.yml', root);
  const load = () => parseShortLinks(readFileSync(shortLinksFile(), 'utf8'));

  return {
    name: 'short-links',
    hooks: {
      'astro:config:setup': ({ config, addWatchFile }) => {
        root = config.root;
        addWatchFile(shortLinksFile());
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const name = req.url?.match(/^\/([^/?#]+)\/?(?:[?#].*)?$/)?.[1];
          const link = name ? load().find((l) => l.name === name) : undefined;
          if (!link) return next();
          res.writeHead(302, { Location: link.to }).end();
        });
      },
      'astro:build:done': ({ dir }) => {
        const links = load();
        const redirectsFile = new URL('_redirects', dir);
        const hardCoded = existsSync(redirectsFile) ? readFileSync(redirectsFile, 'utf8') : '';
        const functionsDir = new URL('functions/', root);
        const pathExists = (path: string) => {
          const name = path.slice(1);
          return [
            new URL(name, dir),
            new URL(`${name}.html`, dir),
            new URL(name, functionsDir),
            new URL(`${name}.js`, functionsDir),
            new URL(`${name}.ts`, functionsDir),
          ].some((url) => existsSync(url));
        };

        const problems = findConflicts(links, { hardCodedSources: redirectSources(hardCoded), pathExists });
        if (problems.length > 0) {
          throw new Error(`Bad short links in src/data/short-links.yml:\n  ${problems.join('\n  ')}`);
        }
        appendFileSync(redirectsFile, `\n# Short links, from src/data/short-links.yml\n${renderRedirects(links)}`);
      },
    },
  };
}
