import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4180);
const cache = new Map();
const ttl = 8 * 60 * 1000;
const feeds = [
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'SecurityWeek', url: 'https://www.securityweek.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Cyber Security News', url: 'https://cybersecuritynews.com/feed/' },
  { name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml' },
  { name: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/alerts.xml' }
];

function text(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}

export function parseRss(xml, source) {
  return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0, 25).map(([, , item]) => {
    const get = (tag) => item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '';
    const link = item.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || text(get('link'));
    return { source, title: text(get('title')) || 'Untitled report', summary: text(get('description') || get('summary') || get('content')).slice(0, 420), link, published: text(get('pubDate') || get('published') || get('updated')) };
  }).filter((item) => item.title && item.link.startsWith('http'));
}

async function cached(key, fetcher) {
  const old = cache.get(key);
  if (old && Date.now() - old.at < ttl) return old.value;
  const value = await fetcher();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function incidentNews() {
  const settled = await Promise.allSettled(feeds.map(async (feed) => {
    const xml = await cached(feed.name, async () => {
      const response = await fetch(feed.url, { headers: { 'user-agent': 'YORU-Threat-Radar/0.1 (+local personal dashboard)' }, signal: AbortSignal.timeout(9000) });
      if (!response.ok) throw new Error(`${feed.name} returned ${response.status}`);
      return response.text();
    });
    return parseRss(xml, feed.name);
  }));
  const items = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const seen = new Set();
  const uniqueItems = items.filter((item) => {
    try {
      const url = new URL(item.link);
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
      const canonical = url.href.replace(/\/$/, '').toLowerCase();
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    } catch { return false; }
  });
  const unavailable = settled.flatMap((result, index) => result.status === 'rejected' ? [feeds[index].name] : []);
  const sources = settled.map((result, index) => ({ name: feeds[index].name, available: result.status === 'fulfilled', count: result.status === 'fulfilled' ? result.value.length : 0 }));
  return { items: uniqueItems.sort((a, b) => Date.parse(b.published) - Date.parse(a.published)), sources, unavailable };
}

async function kevCatalog() {
  return cached('kev', async () => {
    const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`CISA returned ${response.status}`);
    const data = await response.json();
    return { updated: data.dateReleased, count: data.count, entries: (data.vulnerabilities || []).slice(-150).reverse() };
  });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'");
  try {
    if (url.searchParams.has('refresh')) cache.clear();
    if (url.pathname === '/api/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ app: 'YORU', version: '0.2.0', status: 'ok' })); return; }
    if (url.pathname === '/api/news') { const result = await incidentNews(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(result)); return; }
    if (url.pathname === '/api/kev') { const result = await kevCatalog(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(result)); return; }
    const requested = (url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const publicRoot = join(root, 'public');
    const file = normalize(join(publicRoot, requested));
    const relativeFile = relative(publicRoot, file);
    if (relativeFile.startsWith(`..${sep}`) || relativeFile === '..') { res.writeHead(403); res.end('Forbidden'); return; }
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'A source could not be loaded. Try again shortly.', detail: error.message }));
  }
});
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  server.listen(port, '127.0.0.1', () => console.log(`YORU is ready at http://127.0.0.1:${port}`));
}
