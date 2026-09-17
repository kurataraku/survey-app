/**
 * 都道府県LPの配信状態（静的配信・CDNキャッシュ・HTMLサイズ・TTFB）を実測するCLI。
 *
 * 施策の合否をGoogleのインデックス状況ではなく、観測できる配信指標で判定するために使う。
 *
 * 使い方:
 *   npm run seo:check:delivery                                  # 優先9県
 *   npm run seo:check:delivery -- --all
 *   npm run seo:check:delivery -- --prefectures=東京都,愛知県
 *   npm run seo:check:delivery -- --base=https://careeressence.jp/tsushin-kuchikomi
 *   npm run seo:check:delivery -- --out=.seo/delivery-after.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { BASE_PATH } from '../lib/base-path';
import { getPrefecturePath, prefectures } from '../lib/prefectures';

const PRIORITY_PREFECTURES = [
  '東京都',
  '神奈川県',
  '愛知県',
  '大阪府',
  '埼玉県',
  '千葉県',
  '兵庫県',
  '福岡県',
  '北海道',
];

/** 受け入れ基準: 1ページのHTMLは700KB以内 */
const HTML_SIZE_BUDGET_BYTES = 700 * 1024;

type DeliveryResult = {
  prefecture: string;
  url: string;
  status: number;
  cacheControl: string | null;
  vercelCache: string | null;
  contentEncoding: string | null;
  htmlBytes: number;
  ttfbMs: number;
  withinBudget: boolean;
  /** CDNキャッシュに載る設定になっているか */
  cacheable: boolean;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function resolveBaseUrl(): string {
  const override = getArg('base');
  if (override) return override.replace(/\/$/, '');

  const siteUrl = process.env.GSC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl || siteUrl.startsWith('sc-domain:')) {
    throw new Error('--base=https://example.com/tsushin-kuchikomi を指定してください');
  }
  return `${siteUrl.replace(/\/$/, '')}${BASE_PATH}`;
}

function resolveTargets(): string[] {
  const explicit = getArg('prefectures');
  if (explicit) {
    return explicit.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return process.argv.includes('--all') ? [...prefectures] : PRIORITY_PREFECTURES;
}

async function measure(prefecture: string, baseUrl: string): Promise<DeliveryResult> {
  const url = `${baseUrl}${getPrefecturePath(prefecture)}`;
  const startedAt = Date.now();
  const response = await fetch(url, { redirect: 'manual' });
  const ttfbMs = Date.now() - startedAt;
  const html = await response.text();

  const cacheControl = response.headers.get('cache-control');
  const htmlBytes = Buffer.byteLength(html, 'utf8');

  return {
    prefecture,
    url,
    status: response.status,
    cacheControl,
    vercelCache: response.headers.get('x-vercel-cache'),
    contentEncoding: response.headers.get('content-encoding'),
    htmlBytes,
    ttfbMs,
    withinBudget: htmlBytes <= HTML_SIZE_BUDGET_BYTES,
    cacheable: Boolean(cacheControl && !/no-store|no-cache/.test(cacheControl)),
  };
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const targets = resolveTargets();
  console.log(`base: ${baseUrl}`);
  console.log(`対象: ${targets.length}都道府県\n`);

  const results: DeliveryResult[] = [];
  for (const prefecture of targets) {
    const result = await measure(prefecture, baseUrl);
    results.push(result);
    console.log(
      [
        result.prefecture.padEnd(5, '　'),
        `status=${result.status}`,
        `html=${(result.htmlBytes / 1024).toFixed(0)}KB`,
        `ttfb=${result.ttfbMs}ms`,
        `cache=${result.vercelCache ?? '-'}`,
        result.cacheable ? 'cacheable' : 'NO-STORE',
        result.withinBudget ? '' : 'OVER-BUDGET',
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  const overBudget = results.filter((r) => !r.withinBudget);
  const notCacheable = results.filter((r) => !r.cacheable);
  const avgHtmlKb = results.reduce((sum, r) => sum + r.htmlBytes, 0) / results.length / 1024;
  const avgTtfb = results.reduce((sum, r) => sum + r.ttfbMs, 0) / results.length;

  console.log(`\n平均HTML: ${avgHtmlKb.toFixed(0)}KB / 平均TTFB: ${avgTtfb.toFixed(0)}ms`);
  console.log(`700KB超: ${overBudget.length}件 / キャッシュ不可: ${notCacheable.length}件`);

  const outPath = getArg('out');
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outPath)), { recursive: true });
    fs.writeFileSync(
      path.resolve(process.cwd(), outPath),
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          baseUrl,
          averageHtmlKb: Number(avgHtmlKb.toFixed(1)),
          averageTtfbMs: Math.round(avgTtfb),
          overBudgetCount: overBudget.length,
          notCacheableCount: notCacheable.length,
          results,
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`\n結果を ${outPath} に保存しました`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
