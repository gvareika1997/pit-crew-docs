// Post-build guards. Run by `npm run build`; any failure exits 1.
//  1. Every internal link and asset in dist/ resolves.
//  2. Every page is in the sidebar (no orphans), and every sidebar slug has a page.
//  3. Neutral core: no file contains a term listed in .docs-banned or DOCS_BANNED.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const docs = 'src/content/docs';
const config = fs.readFileSync('astro.config.mjs', 'utf8');
const base = (process.env.DOCS_BASE ?? '/pit-crew-docs').replace(/\/$/, '');
const errors = [];

const walk = (dir, ext, acc = []) => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, ext, acc);
    else if (ext.some((e) => f.endsWith(e))) acc.push(p);
  }
  return acc;
};

// 1. Links
let links = 0;
for (const file of walk(dist, ['.html'])) {
  const html = fs.readFileSync(file, 'utf8');
  const dir = `${base}/${path.relative(dist, path.dirname(file)).split(path.sep).join('/')}`.replace(/\/$/, '') + '/';
  for (const m of html.matchAll(/(?:href|src|poster)="([^"#]+)(?:#[^"]*)?"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(url)) continue;
    links++;
    const abs = decodeURIComponent(new URL(url, `http://x${dir}`).pathname);
    if (!abs.startsWith(`${base}/`) && abs !== base) {
      errors.push(`link outside base: ${file} -> ${url}`);
      continue;
    }
    let target = path.join(dist, abs.slice(base.length + 1));
    if (abs.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) errors.push(`broken link: ${file} -> ${url}`);
  }
}

// 2. Sidebar coverage
const pages = walk(docs, ['.mdx', '.md']).map((f) =>
  path
    .relative(docs, f)
    .split(path.sep)
    .join('/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, ''),
);
const slugs = [...config.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
for (const p of pages) if (p !== '' && !slugs.includes(p)) errors.push(`page not in the sidebar: ${p}`);
for (const s of slugs) if (!pages.includes(s)) errors.push(`sidebar slug with no page: ${s}`);

// 3. Neutral core. The terms live outside the repo: one regex per line in .docs-banned
//    (git-ignored), or the DOCS_BANNED variable. With neither, this guard is skipped.
const bannedSource = fs.existsSync('.docs-banned')
  ? fs
      .readFileSync('.docs-banned', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('|')
  : (process.env.DOCS_BANNED ?? '');
if (bannedSource) {
  const banned = new RegExp(bannedSource, 'i');
  const tracked = ['src', 'scripts', '.github', 'README.md', 'astro.config.mjs', 'package.json'];
  const files = tracked.flatMap((p) =>
    !fs.existsSync(p) ? [] : fs.statSync(p).isDirectory() ? walk(p, ['.mdx', '.md', '.mjs', '.yml', '.astro', '.css', '.ts']) : [p],
  );
  for (const f of files) {
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (banned.test(line)) errors.push(`banned term: ${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
      });
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\ncheck: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`check: ${pages.length} pages, ${links} internal links, sidebar complete, banned terms ${bannedSource ? 'checked' : 'not configured'}`);
