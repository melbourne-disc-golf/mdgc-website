// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import path from 'path';

import tailwindcss from '@tailwindcss/vite';

import icon from 'astro-icon';

import { rehypeSectionize } from './src/lib/rehype-sectionize.js';
import { externalUrls } from './src/data/external-urls.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.melbournediscgolf.com',
  output: 'static',
  redirects: {
    '/about': '/club',
    '/admin': '/cms/',
    '/contact': '/club#contact-us',
    '/ctb': externalUrls.ctb,
    '/ctp': '/ctb',
    '/melbourne-courses': '/courses',
    '/membership': '/club/membership',
    '/news': '/club/news',
    '/shop': externalUrls.shop,
    '/upcoming-events': '/events',
    '/what-is-disc-golf': '/disc-golf',
    '/club/shop': '/club#shop',
    // Event alias redirects are handled by aliases in event frontmatter
  },
  markdown: {
    processor: unified({ rehypePlugins: [rehypeSectionize] }),
  },
  integrations: [
    mdx({
      gfm: true,
      rehypePlugins: [rehypeSectionize],
    }),
    icon(),
    sitemap(),
  ],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Hanken Grotesk',
      weights: [400, 500, 600, 700],
      cssVariable: '--font-hanken',
    },
    {
      provider: fontProviders.google(),
      name: 'Outfit',
      weights: [400, 500, 600, 700],
      cssVariable: '--font-outfit',
    },
  ],
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'cms-extensionless-urls',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/cms/sveltia') {
              req.url = '/cms/sveltia.html';
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '~': path.resolve('./src'),
      }
    }
  }
});