import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
/** GitHub Pages project site: https://<user>.github.io/rezar-group/ (override with BASE=/ for a custom domain) */
const BASE = process.env.BASE || '/rezar-group/';

/**
 * Build-time HTML partials + base-aware links.
 *   <!--#include header-->   → src/partials/header.html (partials may include partials)
 *   %BASE%                   → the Vite base ('/rezar-group/'), use it for every internal href/src
 *                              that Vite itself does not rewrite (links between pages, public/ files)
 *   <svg data-inline="logo"> → not used; the logo is included as a partial (src/partials/logo.html)
 */
function htmlPartials() {
  const RE = /<!--#include\s+([\w-]+)\s*-->/g;
  const expand = (html, depth = 0) =>
    depth > 5 ? html : html.replace(RE, (_, name) => expand(readFileSync(resolve(root, 'src/partials', `${name}.html`), 'utf8'), depth + 1));
  return {
    name: 'rezar-html-partials',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => expand(html).replaceAll('%BASE%', BASE),
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/partials/') || file.includes('/src/svg/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [htmlPartials()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        catalog: resolve(root, 'catalog/index.html'),
        car: resolve(root, 'car/index.html'),
        notFound: resolve(root, '404.html'),
      },
    },
  },
  server: { host: true, watch: { ignored: ['**/docs/**', '**/dist/**'] } },
});
