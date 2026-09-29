/**
 * 地域LPの配信状態（静的配信・CDNキャッシュ・圧縮前後のHTMLサイズ・warm TTFB）を実測するCLI。
 *
 * 施策の合否をGoogleのインデックス状況ではなく、観測できる配信指標で判定するために使う。
 *
 * 使い方:
 *   npm run seo:check:delivery                                  # 優先9県
 *   npm run seo:check:delivery -- --all
 *   npm run seo:check:delivery -- --prefectures=東京都,愛知県
 *   npm run seo:check:delivery -- --prefectures=愛知県 --cities=nagoya
 *   npm run seo:check:delivery -- --base=https://careeressence.jp/tsushin-kuchikomi
 *   npm run seo:check:delivery -- --out=.seo/delivery-after.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { request } from 'undici';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { BASE_PATH } from '../lib/base-path';
import { getPrefecturePath, prefectures } from '../lib/prefectures';
import { CITY_LANDINGS, getCityLandingPath } from '../lib/regions/city-landing';

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
const TRANSFER_SIZE_BUDGET_BYTES = 150 * 1024;
const WARM_TTFB_BUDGET_MS = 1000;

type DeliveryResult = {
  label: string;
  kind: 'prefecture' | 'city';
  url: string;
  status: number;
  cacheControl: string | null;
  vercelCache: string | null;
  contentEncoding: string | null;
  htmlBytes: number;
  transferBytes: number;
  warmTtfbMs: number;
  ttfbSamplesMs: number[];
  withinHtmlBudget: boolean;
  withinTransferBudget: boolean;
  withinWarmTtfbBudget: boolean;
  /** CDNキャッシュに載る設定になっているか */
  cacheable: boolean;
  cacheHit: boolean;
};

type DeliveryTarget = Pick<DeliveryResult, 'label' | 'kind' | 'url'>;

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

function resolvePrefectureTargets(): string[] {
  const explicit = getArg('prefectures');
  if (explicit) {
    return explicit.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return process.argv.includes('--all') ? [...prefectures] : PRIORITY_PREFECTURES;
}

function resolveTargets(baseUrl: string): DeliveryTarget[] {
  const targets: DeliveryTarget[] = resolvePrefectureTargets().map((prefecture) => ({
    label: prefecture,
    kind: 'prefecture',
    url: `${baseUrl}${getPrefecturePath(prefecture)}`,
  }));
  const cityArg = getArg('cities');
  if (!cityArg) return targets;
  const requested = new Set(cityArg.split(',').map((value) => value.trim()).filter(Boolean));
  for (const config of CITY_LANDINGS) {
    if (!requested.has(config.slug) && !requested.has(config.municipality)) continue;
    targets.push({
      label: config.municipality,
      kind: 'city',
      url: `${baseUrl}${getCityLandingPath(config)}`,
    });
  }
  return targets;
}

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name];
  return Array.isArray(value) ? value.join(', ') : value ?? null;
}

function decodeBody(body: Buffer, encoding: string | null): Buffer {
  if (encoding === 'br') return brotliDecompressSync(body);
  if (encoding === 'gzip') return gunzipSync(body);
  return body;
}

async function fetchMeasure(url: string) {
  const startedAt = Date.now();
  const response = await request(url, {
    headers: { 'accept-encoding': 'br, gzip' },
  });
  const ttfbMs = Date.now() - startedAt;
  const compressedBody = Buffer.from(await response.body.arrayBuffer());
  const contentEncoding = header(response.headers, 'content-encoding');
  const decodedBody = decodeBody(compressedBody, contentEncoding);
  return {
    status: response.statusCode,
    cacheControl: header(response.headers, 'cache-control'),
    vercelCache: header(response.headers, 'x-vercel-cache'),
    contentEncoding,
    htmlBytes: decodedBody.byteLength,
    transferBytes: compressedBody.byteLength,
    ttfbMs,
  };
}

async function measure(target: DeliveryTarget): Promise<DeliveryResult> {
  await fetchMeasure(target.url);
  const samples = [];
  let latest = await fetchMeasure(target.url);
  samples.push(latest.ttfbMs);
  for (let index = 0; index < 2; index += 1) {
    latest = await fetchMeasure(target.url);
    samples.push(latest.ttfbMs);
  }
  const sortedTtfb = [...samples].sort((a, b) => a - b);
  const warmTtfbMs = sortedTtfb[Math.floor(sortedTtfb.length / 2)];
  return {
    ...target,
    status: latest.status,
    cacheControl: latest.cacheControl,
    vercelCache: latest.vercelCache,
    contentEncoding: latest.contentEncoding,
    htmlBytes: latest.htmlBytes,
    transferBytes: latest.transferBytes,
    warmTtfbMs,
    ttfbSamplesMs: samples,
    withinHtmlBudget: latest.htmlBytes <= HTML_SIZE_BUDGET_BYTES,
    withinTransferBudget: latest.transferBytes <= TRANSFER_SIZE_BUDGET_BYTES,
    withinWarmTtfbBudget: warmTtfbMs <= WARM_TTFB_BUDGET_MS,
    cacheable: Boolean(
      latest.cacheControl && !/no-store|no-cache/.test(latest.cacheControl)
    ),
    cacheHit: /HIT|PRERENDER/.test(latest.vercelCache ?? ''),
  };
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const targets = resolveTargets(baseUrl);
  console.log(`base: ${baseUrl}`);
  console.log(`対象: ${targets.length}ページ\n`);

  const results: DeliveryResult[] = [];
  for (const target of targets) {
    const result = await measure(target);
    results.push(result);
    console.log(
      [
        result.label.padEnd(5, '　'),
        `status=${result.status}`,
        `html=${(result.htmlBytes / 1024).toFixed(0)}KB`,
        `transfer=${(result.transferBytes / 1024).toFixed(0)}KB`,
        `warm-ttfb=${result.warmTtfbMs}ms`,
        `cache=${result.vercelCache ?? '-'}`,
        result.cacheable ? 'cacheable' : 'NO-STORE',
        result.withinHtmlBudget &&
        result.withinTransferBudget &&
        result.withinWarmTtfbBudget &&
        result.cacheHit
          ? ''
          : 'OVER-BUDGET',
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  const overBudget = results.filter(
    (r) =>
      !r.withinHtmlBudget ||
      !r.withinTransferBudget ||
      !r.withinWarmTtfbBudget ||
      !r.cacheHit
  );
  const notCacheable = results.filter((r) => !r.cacheable);
  const avgHtmlKb = results.reduce((sum, r) => sum + r.htmlBytes, 0) / results.length / 1024;
  const avgTransferKb =
    results.reduce((sum, r) => sum + r.transferBytes, 0) / results.length / 1024;
  const avgTtfb = results.reduce((sum, r) => sum + r.warmTtfbMs, 0) / results.length;

  console.log(
    `\n平均HTML: ${avgHtmlKb.toFixed(0)}KB / 平均転送: ${avgTransferKb.toFixed(0)}KB / 平均warm TTFB: ${avgTtfb.toFixed(0)}ms`
  );
  console.log(`予算超過: ${overBudget.length}件 / キャッシュ不可: ${notCacheable.length}件`);

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
          averageTransferKb: Number(avgTransferKb.toFixed(1)),
          averageWarmTtfbMs: Math.round(avgTtfb),
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
