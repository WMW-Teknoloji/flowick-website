/**
 * Build sonrası çalışır: dist/index.html şablonunu alıp her route için
 * içerik + meta + JSON-LD gömülü statik HTML üretir; sitemap.xml ve 404.html yazar.
 *
 * Çalıştırma: npm run build (esbuild ile paketlenip node ile koşulur)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { homeHTML } from '../src/pages/home';
import { productsHTML } from '../src/pages/products';
import { blogHTML } from '../src/pages/blog';
import { blogDetailHTML } from '../src/pages/blog-detail';
import { blogPosts } from '../src/content/blog-posts';
import { metaForPath, jsonLdForPath, toIsoDate, SITE_URL } from '../src/seo';

const DIST = 'dist';

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const template = readFileSync(join(DIST, 'index.html'), 'utf-8');

interface RouteEntry {
  path: string;
  html: string;
  lastmod: string;
}

const buildDate = new Date().toISOString().slice(0, 10);

const routes: RouteEntry[] = [
  { path: '/', html: homeHTML(), lastmod: buildDate },
  { path: '/urunler', html: productsHTML(), lastmod: buildDate },
  { path: '/blog', html: blogHTML(), lastmod: buildDate },
  ...blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    html: blogDetailHTML(post),
    lastmod: toIsoDate(post.date),
  })),
];

function renderPage(path: string, contentHTML: string): string {
  const meta = metaForPath(path);
  const canonicalUrl = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  const jsonLd = JSON.stringify(jsonLdForPath(path));

  const headExtras = [
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:site_name" content="Flowick">`,
    `<meta property="og:locale" content="tr_TR">`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:image" content="${meta.ogImage}">`,
    `<meta property="og:type" content="${meta.ogType}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
    `<meta name="twitter:image" content="${meta.ogImage}">`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n  ');

  // Şablon yapısı değişirse sessizce eski meta ile yayınlamak yerine build'i kır.
  if (!/<title>[^<]*<\/title>/.test(template))
    throw new Error('Şablonda <title> bulunamadı');
  if (!/<meta name="description" content="[^"]*">/.test(template))
    throw new Error('Şablonda meta description bulunamadı');
  if (!template.includes('</head>')) throw new Error('Şablonda </head> bulunamadı');
  if (!template.includes('<main id="app"></main>'))
    throw new Error('Şablonda <main id="app"></main> bulunamadı');

  let page = template;
  page = page.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`);
  page = page.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(meta.description)}">`
  );
  page = page.replace('</head>', `  ${headExtras}\n</head>`);
  page = page.replace('<main id="app"></main>', `<main id="app">${contentHTML}</main>`);
  return page;
}

for (const route of routes) {
  const html = renderPage(route.path, route.html);
  const dir = route.path === '/' ? DIST : join(DIST, route.path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf-8');
  console.log(`prerender OK ${route.path}`);
}

// ---- sitemap.xml ----
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map((r) => {
    const loc = r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n  </url>`;
  })
  .join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf-8');
console.log('prerender OK sitemap.xml');

// ---- 404.html ----
const notFoundContent = `
    <div class="blog-page" style="min-height:60vh;">
      <div class="blog-header">
        <h1>Sayfa Bulunamadı</h1>
      </div>
      <p style="text-align:center;font-family:'Open Sans',sans-serif;">
        Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
        <a href="/">Ana sayfaya dönün</a> veya <a href="/blog">blog yazılarımıza göz atın</a>.
      </p>
    </div>`;
let notFound = template
  .replace(/<title>[^<]*<\/title>/, '<title>Sayfa Bulunamadı | Flowick</title>')
  .replace('</head>', '  <meta name="robots" content="noindex">\n</head>')
  .replace('<main id="app"></main>', `<main id="app">${notFoundContent}</main>`);
writeFileSync(join(DIST, '404.html'), notFound, 'utf-8');
console.log('prerender OK 404.html');
