/**
 * 入学条件・スクーリング確認データの再確認監査。
 *
 * 確認日から12か月を過ぎた公開データ、対象年度が過ぎた公開データ、30日以内に期限を迎える公開データ、
 * 下書きのまま残っているデータを一覧にする。期限切れの公開データは公開側では自動的に未確認扱いになるため、
 * このコマンドの出力を再確認作業のキューとして使う。
 *
 * 使い方:
 *   npm run seo:audit:admission
 *   npm run seo:audit:admission -- --json
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import {
  ADMISSION_REVERIFY_MONTHS,
  isMissingTableError,
  needsReverification,
  type SchoolAdmissionProfile,
} from '@/lib/schools/admissionProfiles';

const SOON_DAYS = 30;

type Row = Pick<
  SchoolAdmissionProfile,
  'school_id' | 'status' | 'verified_at' | 'target_year' | 'admission_scope'
> & { schools: { name: string; slug: string | null } | null };

function dueDate(verifiedAt: string): Date {
  const date = new Date(`${verifiedAt}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + ADMISSION_REVERIFY_MONTHS);
  return date;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase の環境変数が未設定です');

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('school_admission_profiles')
    .select('school_id, status, verified_at, target_year, admission_scope, schools(name, slug)');

  if (error) {
    if (isMissingTableError(error)) {
      console.log(
        'school_admission_profiles が未作成です。supabase-migrations/create-school-admission-profiles.sql を適用してください。'
      );
      return;
    }
    throw error;
  }

  const now = new Date();
  const soon = new Date(now.getTime() + SOON_DAYS * 24 * 60 * 60 * 1000);
  const rows = (data ?? []) as unknown as Row[];

  const toItem = (row: Row) => ({
    school: row.schools?.name ?? row.school_id,
    slug: row.schools?.slug ?? null,
    verified_at: row.verified_at,
    due: row.verified_at ? dueDate(row.verified_at).toISOString().slice(0, 10) : null,
    target_year: row.target_year,
  });

  const published = rows.filter((row) => row.status === 'published');
  const expired = published.filter((row) => needsReverification(row, now)).map(toItem);
  const dueSoon = published
    .filter((row) => !needsReverification(row, now) && needsReverification(row, soon))
    .map(toItem);
  const drafts = rows.filter((row) => row.status === 'draft').map(toItem);
  const current = published.length - expired.length;

  const report = {
    generated_at: now.toISOString(),
    reverify_months: ADMISSION_REVERIFY_MONTHS,
    totals: { profiles: rows.length, published: published.length, current, expired: expired.length, due_soon: dueSoon.length, drafts: drafts.length },
    expired,
    due_soon: dueSoon,
    drafts,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`入学条件データ: ${rows.length}件（公開 ${published.length} / 有効 ${current} / 下書き ${drafts.length}）`);
  console.log(`\n■ 期限切れ（公開側では未確認扱い）: ${expired.length}件`);
  expired.forEach((item) => console.log(`  - ${item.school}  確認日 ${item.verified_at ?? '-'}  年度 ${item.target_year ?? '-'}`));
  console.log(`\n■ ${SOON_DAYS}日以内に期限: ${dueSoon.length}件`);
  dueSoon.forEach((item) => console.log(`  - ${item.school}  期限 ${item.due}`));
  console.log(`\n■ 下書きのまま: ${drafts.length}件`);
  drafts.forEach((item) => console.log(`  - ${item.school}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
