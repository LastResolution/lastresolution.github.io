import { readFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const publicFiles = Object.freeze([
  'index.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', '.nojekyll',
  'assets/styles.css', 'assets/site.js', 'assets/avatar.png',
  'assets/favicon.png', 'assets/apple-touch-icon.png', 'assets/social-preview.png',
  'assets/restart-logo.png', 'assets/restart-dark.png', 'assets/restart-light.png'
]);
const origin = 'https://lastresolution.github.io';
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1],match[2]]));
const tags = (html,name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(match => attrs(match[0]));
const privacy = /[A-Z]:[\\/]+Users[\\/]+[^\s<>"']+|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;

/**
 * Validate the public homepage, root-domain identity and exact deployment payload.
 * @param {string} directory Source or assembled directory to read without mutation.
 * @param {{distribution?:boolean}} options Reject all unlisted files in an assembled distribution when true.
 * @returns {Promise<{files:number,checks:number}>} Number of intentional public files and successful assertions.
 * @throws {Error} On invalid metadata, assets, links, privacy patterns or unexpected distribution files.
 */
export async function verifySite(directory = root, { distribution = false } = {}) {
  directory = path.resolve(directory);
  let checks = 0;
  const require = (value, message) => { if (!value) throw new Error(message); checks++; };
  for (const file of publicFiles) {
    const full = path.join(directory,file);
    for (let part = full; part !== path.resolve(directory); part = path.dirname(part)) require(!(await lstat(part)).isSymbolicLink(), `Linked public path: ${file}`);
    require((await lstat(full)).isFile(), `Missing public file: ${file}`);
    require(!privacy.test((await readFile(full)).toString('utf8')), `Private data pattern: ${file}`);
  }
  if (distribution) {
    const listed = [];
    async function collect(folder) {
      for (const entry of await readdir(folder,{withFileTypes:true})) {
        const full = path.join(folder,entry.name);
        require(!entry.isSymbolicLink(), 'Linked distribution entry.');
        if (entry.isDirectory()) await collect(full); else listed.push(path.relative(directory,full).replaceAll(path.sep,'/'));
      }
    }
    await collect(directory);
    require(listed.sort().join('\n') === [...publicFiles].sort().join('\n'), 'Unexpected deployment files.');
  }
  const html = await readFile(path.join(directory,'index.html'),'utf8');
  const css = await readFile(path.join(directory,'assets/styles.css'),'utf8');
  const js = await readFile(path.join(directory,'assets/site.js'),'utf8');
  require(/<!doctype html>/i.test(html) && /<html lang="en">/.test(html), 'Missing English document declaration.');
  require((html.match(/<h1\b/g)||[]).length === 1 && (html.match(/<main\b/g)||[]).length === 1, 'A single main and h1 are required.');
  require(!/GitHub Pages documentation|Site not found|lorem ipsum|TODO|PLACEHOLDER/i.test(html), 'Placeholder/default content.');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  require(new Set(ids).size === ids.length, 'Duplicate IDs.');
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  require(title?.startsWith('LastResolution —') && title.length < 90, 'Missing creator title.');
  const meta = tags(html,'meta');
  const metadata = key => {
    const found = meta.filter(item => item.name === key || item.property === key);
    require(found.length === 1 && found[0].content?.trim(), `Missing/duplicate metadata: ${key}`);
    return found[0].content;
  };
  require(metadata('description').length >= 90 && metadata('description').length <= 180, 'Invalid description length.');
  require(metadata('og:site_name') === 'LastResolution', 'Root site name must identify the creator.');
  require(metadata('og:title') === title && metadata('twitter:title') === title, 'Inconsistent social titles.');
  require(metadata('og:url') === origin+'/', 'Wrong social canonical.');
  require(metadata('og:type') === 'website' && metadata('twitter:card') === 'summary_large_image', 'Incorrect social cards.');
  require(metadata('og:description').length > 30 && metadata('twitter:description').length > 30, 'Missing social descriptions.');
  require(metadata('og:image') === origin+'/assets/social-preview.png' && metadata('twitter:image') === metadata('og:image'), 'Invalid social image.');
  require(metadata('og:image:width') === '1280' && metadata('og:image:height') === '640', 'Wrong social dimensions.');
  require(metadata('og:image:alt').includes('LastResolution'), 'Missing social alt text.');
  const canonical = tags(html,'link').filter(link => link.rel === 'canonical');
  require(canonical.length === 1 && canonical[0].href === origin+'/', 'Wrong root canonical.');
  require(!meta.some(item => /robots/i.test(item.name||'') && /noindex|nofollow/i.test(item.content||'')), 'Page excludes indexing.');
  require(tags(html,'link').some(link => link.rel === 'icon' && link.href === '/assets/favicon.png'), 'Missing crawlable root favicon.');
  const graphTags = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  require(graphTags.length === 1, 'Missing/duplicate structured data.');
  const graph = JSON.parse(graphTags[0][1]);
  const website = graph['@graph']?.filter(node => node['@type'] === 'WebSite');
  require(graph['@context'] === 'https://schema.org' && website?.length === 1, 'Invalid WebSite graph.');
  require(website[0].name === 'LastResolution' && website[0].url === origin+'/', 'Wrong WebSite name/root URL.');
  const creator = graph['@graph'].find(node => node['@type'] === 'Person');
  require(creator?.name === 'LastResolution' && creator.sameAs.includes('https://github.com/LastResolution'), 'Invalid public creator identity.');
  require(website[0].author?.['@id'] === creator['@id'], 'Unresolved creator reference.');
  require(html.includes('class="skip-link" href="#main"') && css.includes(':focus-visible'), 'Missing keyboard navigation affordances.');
  require(css.includes('prefers-reduced-motion:reduce') && css.includes('prefers-color-scheme:dark') && css.includes('forced-colors:active'), 'Missing display/accessibility preferences.');
  require(css.includes('max-width:760px') && css.includes('max-width:370px'), 'Missing mobile layouts.');
  require(!/\b(?:eval|fetch|XMLHttpRequest)\s*\(|document\.cookie|sendBeacon|serviceWorker/.test(js), 'Unexpected runtime data/remote execution.');
  const policy = meta.find(item => item['http-equiv'] === 'Content-Security-Policy')?.content;
  require(policy?.includes("connect-src 'none'") && !policy.includes('unsafe-inline'), 'Missing restrictive content policy.');
  const publicSet = new Set(publicFiles);
  const allowedHosts = new Set(['github.com','buymeacoffee.com']);
  for (const target of [...tags(html,'a').map(a=>a.href),...tags(html,'img').map(a=>a.src),...tags(html,'source').map(a=>a.srcset),...tags(html,'script').map(a=>a.src),...tags(html,'link').map(a=>a.href)].filter(Boolean)) {
    if (target.startsWith('#')) require(ids.includes(target.slice(1)), `Broken anchor ${target}`);
    else {
      const url = new URL(target,origin);
      require(url.protocol === 'https:' && !url.username && !url.password, 'Unsafe link protocol.');
      if (url.origin === origin) require(url.pathname === '/' || url.pathname.startsWith('/ReStart/') || publicSet.has(url.pathname.slice(1)), `Broken public path ${target}`);
      else require(allowedHosts.has(url.hostname), `Unexpected external destination ${url.hostname}`);
    }
  }
  for (const image of tags(html,'img')) require('alt' in image && Number(image.width)>0 && Number(image.height)>0, 'Image needs alt and dimensions.');
  for (const file of publicFiles.filter(file=>file.endsWith('.png'))) {
    const bytes = await readFile(path.join(directory,file));
    require(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `Invalid PNG ${file}`);
    require(bytes.length < 1024*1024, `Oversized public image ${file}`);
    if (file.endsWith('social-preview.png')) require(bytes.readUInt32BE(16) === 1280 && bytes.readUInt32BE(20) === 640, 'Invalid social raster dimensions.');
    if (file.endsWith('favicon.png')) require(bytes.readUInt32BE(16) === 96 && bytes.readUInt32BE(20) === 96, 'Invalid favicon dimensions.');
  }
  const light = await readFile(path.join(directory,'assets/restart-light.png'));
  const dark = await readFile(path.join(directory,'assets/restart-dark.png'));
  require(createHash('sha256').update(light).digest('hex') !== createHash('sha256').update(dark).digest('hex'), 'Theme screenshots must differ.');
  const sitemap = await readFile(path.join(directory,'sitemap.xml'),'utf8');
  require(sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') && [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]).join() === origin+'/', 'Invalid root sitemap.');
  const robots = await readFile(path.join(directory,'robots.txt'),'utf8');
  require(/User-agent: \*\s+Allow: \//.test(robots) && !/Disallow:\s*\//.test(robots), 'Root robots blocks projects.');
  require(robots.includes(`Sitemap: ${origin}/sitemap.xml`) && robots.includes(`Sitemap: ${origin}/ReStart/sitemap.xml`), 'Missing root/project sitemap discovery.');
  return { files:publicFiles.length, checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await verifySite(process.argv[2] || root));
