// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
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
    rehypePlugins: [rehypeSectionize],
  },
  integrations: [
    mdx({
      rehypePlugins: [rehypeSectionize],
    }),
    icon(),
    sitemap(),
  ],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      weights: [400, 600, 700, 800, 900],
      cssVariable: '--font-inter',
    },
    {
      provider: fontProviders.google(),
      name: 'Nunito',
      weights: [300, 400, 600, 700],
      cssVariable: '--font-nunito',
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
            } else if (req.url === '/cms/decap') {
              req.url = '/cms/decap.html';
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