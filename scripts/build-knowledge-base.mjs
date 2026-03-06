import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUT_DIR = path.join(__dirname, '..', 'src', 'data');
const OUT_FILE = path.join(OUT_DIR, 'knowledge-base.json');

function humanizeFilename(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/^[ns]\d+-/, (m) => m.toUpperCase())
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function walkDir(dir, base = '') {
  const entries = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, item.name);
    if (item.isDirectory()) {
      entries.push(...walkDir(path.join(dir, item.name), rel));
    } else if (item.name.endsWith('.md')) {
      const content = fs.readFileSync(path.join(dir, item.name), 'utf-8');
      const headingMatch = content.match(/^#\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1] : humanizeFilename(item.name);
      const slug = rel.replace(/\.md$/, '').replace(/\\/g, '/');
      const folder = base ? base.replace(/\\/g, '/') : 'general';
      entries.push({ slug, title, folder, content });
    }
  }
  return entries;
}

const articles = walkDir(DOCS_DIR);

articles.sort((a, b) => {
  if (a.folder !== b.folder) return a.folder.localeCompare(b.folder);
  return a.title.localeCompare(b.title);
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(articles, null, 2));
console.log(`[knowledge-base] Built ${articles.length} articles → ${OUT_FILE}`);
