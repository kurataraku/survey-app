import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'app');
const survey = path.join(root, '(survey)');

const dirs = ['about', 'contact', 'export', 'features', 'privacy', 'terms', 'rankings', 'reviews', 'schools', 'survey'];

function moveDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
  console.log('Moved:', path.relative(root, src), '->', path.relative(root, dest));
}

for (const d of dirs) {
  moveDir(path.join(root, d), path.join(survey, d));
}

const pageSrc = path.join(root, 'page.tsx');
const pageDest = path.join(survey, 'page.tsx');
if (fs.existsSync(pageSrc)) {
  fs.renameSync(pageSrc, pageDest);
  console.log('Moved: page.tsx -> (survey)/page.tsx');
}

console.log('Done.');
