import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getGscSiteUrl, querySearchAnalytics } from '../lib/gsc/client';
import { getGscComparisonPeriods } from '../lib/gsc/periods';
import { CITY_LANDINGS, getCityLandingPath } from '../lib/regions/city-landing';
import { PREFECTURE_PAGE_CITY_TARGETS } from '../lib/regions/city-landing-candidates';
import { getPrefecturePath } from '../lib/prefectures';

dotenv.config({ path: '.env.local' });

const CITY_QUERY_TERMS = [
  ...new Set([
    ...CITY_LANDINGS.map((city) => city.municipality.replace(/[市区]$/, '')),
    ...PREFECTURE_PAGE_CITY_TARGETS.map((city) => city.municipality.replace(/[市区]$/, '')),
  ]),
];

async function main() {
  const siteUrl = getGscSiteUrl();
  const periods = getGscComparisonPeriods(28);
  const cityPagePaths = CITY_LANDINGS.map((city) => getCityLandingPath(city));
  const prefecturePaths = [
    ...new Set([
      ...CITY_LANDINGS.map((city) => getPrefecturePath(city.prefecture)),
      ...PREFECTURE_PAGE_CITY_TARGETS.map((city) => getPrefecturePath(city.prefecture)),
    ]),
  ];

  const [pages, queries] = await Promise.all([
    querySearchAnalytics({
      siteUrl,
      period: periods.current,
      dimensions: ['page'],
      rowLimit: 5000,
    }),
    querySearchAnalytics({
      siteUrl,
      period: periods.current,
      dimensions: ['query'],
      rowLimit: 5000,
    }),
  ]);

  const relevantPages = pages.filter((row) =>
    prefecturePaths.some((pagePath) => row.keys[0]?.includes(pagePath))
  );
  const relevantQueries = queries.filter((row) => {
    const query = row.keys[0] ?? '';
    return (
      /通信|高校|高等|サポート|学院/.test(query) &&
      CITY_QUERY_TERMS.some((term) => query.includes(term))
    );
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    period: periods.current,
    cityPagePaths,
    prefecturePaths,
    pages: relevantPages,
    queries: relevantQueries,
  };
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.seo', 'gsc-city-before.json');
  await fs.writeFile(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`saved ${relevantPages.length} pages / ${relevantQueries.length} queries to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
