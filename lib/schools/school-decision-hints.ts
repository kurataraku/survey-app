import type { SchoolWithStats } from '@/lib/schools/getSchoolWithStats';

function appendTuitionVsGlobal(schoolVal: number, globalVal: number | null | undefined): string {
  if (globalVal == null || Number.isNaN(globalVal)) return '';
  const diff = Math.round((schoolVal - globalVal) * 10) / 10;
  const g = globalVal.toFixed(1);
  if (Math.abs(diff) < 0.05) {
    return ` サイト全体の回答平均（${g}）とほぼ同水準です。`;
  }
  if (diff > 0) {
    return ` サイト全体の回答平均（${g}）より${diff.toFixed(1)}高めです。`;
  }
  return ` サイト全体の回答平均（${g}）より${Math.abs(diff).toFixed(1)}低めです。`;
}

/**
 * 学費平均・通学頻度分布から、FV用の短文ヒントを生成（口コミ統計ベース）。
 * 学費の納得感はサイト全体平均との比較を付与する。
 */
export function buildTuitionAttendStatsHint(
  school: Pick<
    SchoolWithStats,
    'tuition_rating_avg' | 'statistics' | 'review_count' | 'global_averages'
  >
): string | null {
  const parts: string[] = [];

  if (school.tuition_rating_avg != null && !Number.isNaN(school.tuition_rating_avg)) {
    const schoolVal = school.tuition_rating_avg;
    let s = `学費の納得感の平均は${schoolVal.toFixed(1)}（5段階）です。`;
    s += appendTuitionVsGlobal(schoolVal, school.global_averages?.tuition_rating_avg);
    parts.push(s);
  }

  const freq = school.statistics?.attendance_frequency;
  const total = school.review_count;
  if (freq && total > 0) {
    const entries = Object.entries(freq)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    if (entries.length > 0) {
      const bits = entries.map(
        ([label, count]) => `${label}が約${Math.round((count / total) * 100)}%`
      );
      parts.push(`主な通学頻度は、${bits.join('、')}の回答があります。`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
