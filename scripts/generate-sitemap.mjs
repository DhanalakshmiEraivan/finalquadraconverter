import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const toolsFile = path.join(
  ROOT,
  'src',
  'data',
  'tools.ts'
);

const publicDir = path.join(
  ROOT,
  'public'
);

const sitemapFile = path.join(
  publicDir,
  'sitemap.xml'
);

const content = fs.readFileSync(
  toolsFile,
  'utf8'
);

/*
 * Only read tool IDs from the actual tools array.
 * This prevents category IDs from being added.
 */
const toolsSection = content.split(
  'export const tools: Tool[] = ['
)[1] || '';

const toolIds = [
  ...toolsSection.matchAll(
    /\{\s*id:\s*'([^']+)'/g
  ),
].map(match => match[1]);

const uniqueToolIds = [
  ...new Set(toolIds),
];

const staticRoutes = [
  '/',
  '/tools',
  '/features',
  '/about',
  '/contact',
  '/security',
  '/pricing',
  '/signatures',
];

const toolRoutes = uniqueToolIds.map(
  id => `/${id}`
);

const routes = [
  ...staticRoutes,
  ...toolRoutes,
];

const today = new Date()
  .toISOString()
  .split('T')[0];

const urls = routes
  .map(
    route => `
  <url>
    <loc>https://quadraconverter.in${route}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join('');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls}
</urlset>
`;

fs.mkdirSync(publicDir, {
  recursive: true,
});

fs.writeFileSync(
  sitemapFile,
  sitemap.trim() + '\n',
  'utf8'
);

console.log(
  `Generated sitemap with ${routes.length} URLs`
);

console.log(
  `Sitemap: ${sitemapFile}`
);
