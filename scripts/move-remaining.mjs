import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(__dirname, '..', 'app');
const survey = path.join(app, '(survey)');

const dirs = ['features', 'privacy', 'terms', 'rankings', 'reviews', 'schools', 'survey'];

for (const d of dirs) {
  const src = path.join(app, d);
  const dest = path.join(survey, d);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, dest, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true });
  console.log('Moved', d);
}

const pageSrc = path.join(app, 'page.tsx');
const pageDest = path.join(survey, 'page.tsx');
if (fs.existsSync(pageSrc)) {
  fs.copyFileSync(pageSrc, pageDest);
  fs.unlinkSync(pageSrc);
  console.log('Moved page.tsx');
}

console.log('Done');
