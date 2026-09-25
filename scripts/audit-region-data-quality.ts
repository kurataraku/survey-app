/**
 * 地域LPのデータ品質を都道府県別に監査するCLI。
 *
 * 掲載校の内訳、キャンパス所在地・最寄駅の充足率、公式URLの確認状態、
 * 学費の確認状態、口コミの地域帰属を1回の実行で確認する。
 *
 * 使い方:
 *   npm run seo:audit:region
 *   npm run seo:audit:region -- --all
 *   npm run seo:audit:region -- --out=.seo/region-data-quality.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { normalizeCampusLocations, getCampusNearestStations } from '@/lib/schools/campusLocations';
import { prefectures } from '@/lib/prefectures';
import type { SchoolCampusLocation } from '@/lib/types/schools';

const PRIORITY_PREFECTURES = [
  '東京都',
  '神奈川県',
  '大阪府',
  '愛知県',
  '埼玉県',
  '千葉県',
  '福岡県',
  '兵庫県',
  '京都府',
];

type SchoolRow = {
  id: string;
  name: string;
  slug: string | null;
  prefecture: string | null;
  prefectures: string[] | null;
  institution_type: string | null;
  campus_locations: SchoolCampusLocation[] | null;
  official_url: string | null;
  official_url_verified: boolean | null;
  intro: string | null;
};

type PrefectureAudit = {
  prefecture: string;
  totalSchools: number;
  localHeadquarters: number;
  localCampusSchools: number;
  localCampusLocations: number;
  /** 県内拠点が未登録で、対応都道府県としてのみ関連付く学校 */
  withoutLocalLocation: number;
  byInstitutionType: Record<string, number>;
  /** 県内拠点のうち市区町村が入っている割合 */
  cityFillRate: number;
  /** 県内拠点のうち最寄駅が入っている割合 */
  stationFillRate: number;
  officialUrlPresent: number;
  officialUrlVerified: number;
  introPresent: number;
  tuitionByState: Record<string, number>;
  /** その県をキャンパス都道府県として回答した公開口コミ件数 */
  localReviewCount: number;
  /** 掲載校の学校全体口コミ合計 */
  allReviewCount: number;
  schoolsWithLocalReviews: number;
};

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: schoolRows, error: schoolsError } = await supabase
    .from('schools')
    .select(
      'id, name, slug, prefecture, prefectures, institution_type, campus_locations, official_url, official_url_verified, intro'
    )
    .eq('status', 'active')
    .eq('is_public', true);
  if (schoolsError) throw schoolsError;

  const schools: SchoolRow[] = (schoolRows ?? []).map((row) => ({
    ...row,
    campus_locations: normalizeCampusLocations(row.campus_locations),
  }));

  const { data: reviewRows, error: reviewsError } = await supabase
    .from('survey_responses')
    .select('school_id, answers')
    .eq('is_public', true);
  if (reviewsError) throw reviewsError;

  const { data: tuitionRows, error: tuitionError } = await supabase
    .from('school_tuition_estimates')
    .select('school_id, display_mode')
    .eq('status', 'published');
  if (tuitionError) throw tuitionError;

  const tuitionBySchool = new Map<string, string>();
  for (const row of tuitionRows ?? []) {
    if (row.school_id) tuitionBySchool.set(row.school_id, row.display_mode ?? 'unknown');
  }

  // 口コミの地域帰属: answers.campus_prefecture を集計
  const reviewsBySchool = new Map<string, number>();
  const localReviewsBySchoolPrefecture = new Map<string, number>();
  let reviewsWithCampusPrefecture = 0;
  for (const row of reviewRows ?? []) {
    if (!row.school_id) continue;
    reviewsBySchool.set(row.school_id, (reviewsBySchool.get(row.school_id) ?? 0) + 1);
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    const campusPrefecture =
      typeof answers.campus_prefecture === 'string' ? answers.campus_prefecture : null;
    if (campusPrefecture) {
      reviewsWithCampusPrefecture += 1;
      const key = `${row.school_id}::${campusPrefecture}`;
      localReviewsBySchoolPrefecture.set(key, (localReviewsBySchoolPrefecture.get(key) ?? 0) + 1);
    }
  }

  const targets = process.argv.includes('--all') ? [...prefectures] : PRIORITY_PREFECTURES;
  const audits: PrefectureAudit[] = [];

  for (const prefecture of targets) {
    const related = schools.filter((school) => {
      if (school.prefecture === prefecture) return true;
      if (school.prefectures?.includes(prefecture)) return true;
      return school.campus_locations?.some((loc) => loc.prefecture === prefecture) ?? false;
    });

    const localLocations = related.flatMap(
      (school) => school.campus_locations?.filter((loc) => loc.prefecture === prefecture) ?? []
    );

    const byInstitutionType: Record<string, number> = {};
    for (const school of related) {
      const key = school.institution_type ?? 'unknown';
      byInstitutionType[key] = (byInstitutionType[key] ?? 0) + 1;
    }

    const tuitionByState: Record<string, number> = {
      amounts: 0,
      varies: 0,
      contact_required: 0,
      unconfirmed: 0,
    };
    for (const school of related) {
      const mode = tuitionBySchool.get(school.id);
      if (mode === 'amounts' || mode === 'varies' || mode === 'contact_required') {
        tuitionByState[mode] += 1;
      } else {
        tuitionByState.unconfirmed += 1;
      }
    }

    let localReviewCount = 0;
    let schoolsWithLocalReviews = 0;
    let allReviewCount = 0;
    for (const school of related) {
      allReviewCount += reviewsBySchool.get(school.id) ?? 0;
      const local = localReviewsBySchoolPrefecture.get(`${school.id}::${prefecture}`) ?? 0;
      if (local > 0) {
        localReviewCount += local;
        schoolsWithLocalReviews += 1;
      }
    }

    audits.push({
      prefecture,
      totalSchools: related.length,
      localHeadquarters: related.filter((s) => s.prefecture === prefecture).length,
      localCampusSchools: related.filter(
        (s) => s.campus_locations?.some((loc) => loc.prefecture === prefecture) ?? false
      ).length,
      localCampusLocations: localLocations.length,
      withoutLocalLocation: related.filter(
        (s) =>
          s.prefecture !== prefecture &&
          !(s.campus_locations?.some((loc) => loc.prefecture === prefecture) ?? false)
      ).length,
      byInstitutionType,
      cityFillRate: rate(
        localLocations.filter((loc) => Boolean(loc.city?.trim())).length,
        localLocations.length
      ),
      stationFillRate: rate(
        localLocations.filter((loc) => getCampusNearestStations(loc).length > 0).length,
        localLocations.length
      ),
      officialUrlPresent: related.filter((s) => Boolean(s.official_url)).length,
      officialUrlVerified: related.filter((s) => s.official_url_verified === true).length,
      introPresent: related.filter((s) => (s.intro ?? '').trim().length >= 120).length,
      tuitionByState,
      localReviewCount,
      allReviewCount,
      schoolsWithLocalReviews,
    });
  }

  console.log(`公開校: ${schools.length}校 / 公開口コミ: ${reviewRows?.length ?? 0}件`);
  console.log(
    `口コミのキャンパス都道府県あり: ${reviewsWithCampusPrefecture}件 (${rate(
      reviewsWithCampusPrefecture,
      reviewRows?.length ?? 0
    )}%)`
  );
  console.log(`公開済み学費データ: ${tuitionRows?.length ?? 0}件\n`);

  for (const audit of audits) {
    console.log(`=== ${audit.prefecture} ===`);
    console.log(
      `  掲載 ${audit.totalSchools}校 (本校${audit.localHeadquarters} / キャンパスあり${audit.localCampusSchools} / 拠点未登録${audit.withoutLocalLocation})`
    );
    console.log(
      `  県内拠点 ${audit.localCampusLocations}件 市区町村充足${audit.cityFillRate}% 駅充足${audit.stationFillRate}%`
    );
    console.log(
      `  公式URL ${audit.officialUrlPresent}/${audit.totalSchools} (人手確認済み${audit.officialUrlVerified})  紹介文120字以上 ${audit.introPresent}`
    );
    console.log(
      `  学費 目安${audit.tuitionByState.amounts} / コース別${audit.tuitionByState.varies} / 個別${audit.tuitionByState.contact_required} / 要確認${audit.tuitionByState.unconfirmed}`
    );
    console.log(
      `  口コミ 学校全体${audit.allReviewCount}件 / この県のキャンパス回答${audit.localReviewCount}件 (${audit.schoolsWithLocalReviews}校)`
    );
    console.log(`  種別 ${JSON.stringify(audit.byInstitutionType)}`);
  }

  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  if (outArg) {
    const outPath = outArg.slice('--out='.length);
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outPath)), { recursive: true });
    fs.writeFileSync(
      path.resolve(process.cwd(), outPath),
      JSON.stringify(
        {
          auditedAt: new Date().toISOString(),
          totalSchools: schools.length,
          totalReviews: reviewRows?.length ?? 0,
          reviewsWithCampusPrefecture,
          publishedTuitionRows: tuitionRows?.length ?? 0,
          audits,
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
