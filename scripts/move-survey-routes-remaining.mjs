import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'app');
const survey = path.join(root, '(survey)');

const dirs = ['features', 'privacy', 'terms', 'rankings', 'reviews', 'schools', 'survey'];

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmRecursive(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) rmRecursive(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(p);
}

for (const d of dirs) {
  const src = path.join(root, d);
  const dest = path.join(survey, d);
  if (!fs.existsSync(src)) continue;
  copyDirRecursive(src, dest);
  rmRecursive(src);
  console.log('Moved:', d);
}

const pageSrc = path.join(root, 'page.tsx');
const pageDest = path.join(survey, 'page.tsx');
if (fs.existsSync(pageSrc)) {
  fs.copyFileSync(pageSrc, pageDest);
  fs.unlinkSync(pageSrc);
  console.log('Moved: page.tsx');
}

console.log('Done.');
