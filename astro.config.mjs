// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import path from 'path';

import tailwindcss from '@tailwindcss/vite';

import icon from 'astro-icon';

import { rehypeSectionize } from './src/lib/rehype-sectionize.js';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.melbournediscgolf.com',
  output: 'static',
  redirects: {
    '/about': '/club',
    '/admin': '/cms/',
    '/contact': '/club#contact-us',
    '/ctb': 'https://docs.google.com/forms/d/1qG5hbu89CphfQhYTAXnmCRAqe84S5EgCChU908jlZTQ',
    '/ctp': '/ctb',
    '/melbourne-courses': '/courses',
    '/membership': '/club/membership',
    '/news': '/club/news',
    '/shop': 'https://mdgcshop.square.site/',
    '/upcoming-events': '/events',
    '/what-is-disc-golf': '/disc-golf',
    '/club/shop': '/club#shop',
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
  image: {
    layout: 'constrained'
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