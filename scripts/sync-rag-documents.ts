/**
 * RAGドキュメント同期スクリプト
 *
 * 使い方:
 *   npx tsx scripts/sync-rag-documents.ts --all
 *   npx tsx scripts/sync-rag-documents.ts --reviews=<reviewId1,reviewId2>
 *   npx tsx scripts/sync-rag-documents.ts --schools=<schoolId1,schoolId2>
 *   npx tsx scripts/sync-rag-documents.ts --articles=<articleId1,articleId2>
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  syncRagForAllPublicContent,
  syncRagForArticleIds,
  syncRagForReviewIds,
  syncRagForSchoolIds,
} from '../lib/rag/sync';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function parseIdList(flag: string): string[] {
  const arg = process.argv.slice(2).find((v) => v.startsWith(`${flag}=`));
  if (!arg) return [];
  const [, raw] = arg.split('=');
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const reviewIds = parseIdList('--reviews');
  const schoolIds = parseIdList('--schools');
  const articleIds = parseIdList('--articles');

  if (!all && reviewIds.length === 0 && schoolIds.length === 0 && articleIds.length === 0) {
    console.error(
      '使い方: --all または --reviews / --schools / --articles を指定してください。'
    );
    process.exit(1);
  }

  if (all) {
    const result = await syncRagForAllPublicContent();
    console.log(
      JSON.stringify(
        {
          mode: 'all',
          total: result.total,
          counts: result.counts,
        },
        null,
        2
      )
    );
    return;
  }

  let total = 0;
  if (reviewIds.length > 0) {
    const count = await syncRagForReviewIds(reviewIds);
    total += count;
    console.log(`[reviews] upserted: ${count}`);
  }
  if (schoolIds.length > 0) {
    const count = await syncRagForSchoolIds(schoolIds);
    total += count;
    console.log(`[schools] upserted: ${count}`);
  }
  if (articleIds.length > 0) {
    const count = await syncRagForArticleIds(articleIds);
    total += count;
    console.log(`[articles] upserted: ${count}`);
  }

  console.log(JSON.stringify({ mode: 'partial', total_upserted: total }, null, 2));
}

main().catch((error) => {
  console.error('[sync-rag-documents] error:', error);
  process.exit(1);
});
