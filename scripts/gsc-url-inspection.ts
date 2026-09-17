/**
 * GSC URL Inspection API で都道府県LPの登録状況ベースラインを取得するCLI。
 *
 * 施策前後で「Googleが選んだcanonical」「インデックス状態」を同じ条件で比較できるよう、
 * 実行結果をJSONへ保存する。API上限（1日2000件 / 1分50件）があるため、既定では優先都道府県のみ検査する。
 *
 * 使い方:
 *   npm run seo:gsc:inspect                          # 優先9県
 *   npm run seo:gsc:inspect -- --all                 # 47都道府県
 *   npm run seo:gsc:inspect -- --prefectures=東京都,愛知県
 *   npm run seo:gsc:inspect -- --include-legacy      # 旧日本語URLも検査（canonical誤選択の確認用）
 *   npm run seo:gsc:inspect -- --out=.seo/baseline.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { BASE_PATH } from '../lib/base-path';
import { getGscSiteUrl } from '../lib/gsc/client';
import { inspectUrl, type UrlInspectionResult } from '../lib/gsc/url-inspection';
import { getPrefecturePath, prefectures } from '../lib/prefectures';

/** 検索需要が大きく、優先的に監視する都道府県 */
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

/** 1分50件の上限に対する待機（ms） */
const REQUEST_INTERVAL_MS = 1300;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function resolveTargets(): string[] {
  const explicit = getArg('prefectures');
  if (explicit) {
    const requested = explicit.split(',').map((value) => value.trim()).filter(Boolean);
    const unknown = requested.filter((value) => !prefectures.includes(value));
    if (unknown.length > 0) {
      throw new Error(`未知の都道府県: ${unknown.join(', ')}`);
    }
    return requested;
  }
  return hasFlag('all') ? [...prefectures] : PRIORITY_PREFECTURES;
}

/**
 * 検査するURLのベース。
 *
 * URL Inspection API は GSCプロパティ配下のURLしか受け付けないため、
 * ローカルの NEXT_PUBLIC_SITE_URL ではなく GSC_SITE_URL を基準にする。
 */
function resolveBaseUrl(siteUrl: string): string {
  const override = getArg('base');
  if (override) return override.replace(/\/$/, '');
  if (siteUrl.startsWith('sc-domain:')) {
    throw new Error(
      'ドメインプロパティでは検査URLを決められません。--base=https://example.com/tsushin-kuchikomi を指定してください'
    );
  }
  return `${siteUrl.replace(/\/$/, '')}${BASE_PATH}`;
}

function summarize(result: UrlInspectionResult): string {
  if (!result.ok) return `ERROR ${result.error ?? ''}`;
  const status = result.indexStatus;
  const canonicalMismatch =
    status?.googleCanonical && status?.userCanonical && status.googleCanonical !== status.userCanonical
      ? ' [canonical不一致]'
      : '';
  return `${status?.verdict ?? '-'} / ${status?.coverageState ?? '-'}${canonicalMismatch}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const siteUrl = getGscSiteUrl();
  const baseUrl = resolveBaseUrl(siteUrl);
  const targets = resolveTargets();
  const includeLegacy = hasFlag('include-legacy');

  const urls: { prefecture: string; kind: 'slug' | 'legacy'; url: string }[] = [];
  for (const prefecture of targets) {
    urls.push({
      prefecture,
      kind: 'slug',
      url: `${baseUrl}${getPrefecturePath(prefecture)}`,
    });
    if (includeLegacy) {
      urls.push({
        prefecture,
        kind: 'legacy',
        url: `${baseUrl}/schools/prefecture/${encodeURIComponent(prefecture)}`,
      });
    }
  }

  console.log(`site: ${siteUrl}`);
  console.log(`対象URL: ${urls.length}件（${targets.length}都道府県）`);

  const results: (UrlInspectionResult & { prefecture: string; kind: string })[] = [];
  for (const [index, target] of urls.entries()) {
    const result = await inspectUrl({ siteUrl, inspectionUrl: target.url });
    results.push({ ...result, prefecture: target.prefecture, kind: target.kind });
    console.log(
      `[${index + 1}/${urls.length}] ${target.prefecture}(${target.kind}) ${summarize(result)}`
    );
    if (index < urls.length - 1) await sleep(REQUEST_INTERVAL_MS);
  }

  const indexed = results.filter((r) => r.indexStatus?.verdict === 'PASS').length;
  const canonicalMismatch = results.filter(
    (r) =>
      r.indexStatus?.googleCanonical &&
      r.indexStatus?.userCanonical &&
      r.indexStatus.googleCanonical !== r.indexStatus.userCanonical
  );

  console.log(`\n合格(PASS): ${indexed}/${results.length}`);
  console.log(`canonical不一致: ${canonicalMismatch.length}件`);
  for (const item of canonicalMismatch) {
    console.log(`  ${item.prefecture}: google=${item.indexStatus?.googleCanonical}`);
  }

  const outPath =
    getArg('out') ??
    path.join('.seo', `gsc-url-inspection-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outPath)), { recursive: true });
  fs.writeFileSync(
    path.resolve(process.cwd(), outPath),
    JSON.stringify(
      {
        inspectedAt: new Date().toISOString(),
        siteUrl,
        baseUrl,
        total: results.length,
        passCount: indexed,
        canonicalMismatchCount: canonicalMismatch.length,
        results,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nベースラインを ${outPath} に保存しました`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
