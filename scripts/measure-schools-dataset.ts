/** getSchoolsDataset のシリアライズサイズを測り、Next.jsキャッシュ上限2MBを監視する。 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { fetchSchoolsDatasetUncached } from '@/lib/schools/getSchoolsDataset';

const CACHE_LIMIT_BYTES = 2 * 1024 * 1024;

async function main() {
  const dataset = await fetchSchoolsDatasetUncached();
  const bytes = Buffer.byteLength(JSON.stringify(dataset), 'utf8');
  const result = {
    measuredAt: new Date().toISOString(),
    schoolCount: dataset.length,
    bytes,
    kilobytes: Number((bytes / 1024).toFixed(1)),
    limitBytes: CACHE_LIMIT_BYTES,
    remainingBytes: CACHE_LIMIT_BYTES - bytes,
    withinLimit: bytes <= CACHE_LIMIT_BYTES,
  };
  console.log(JSON.stringify(result, null, 2));
  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  if (outArg) {
    const outPath = path.resolve(process.cwd(), outArg.slice('--out='.length));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  }
  if (bytes > CACHE_LIMIT_BYTES) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
