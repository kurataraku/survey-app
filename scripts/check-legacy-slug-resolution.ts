/**
 * GSC の 404 CSV を読み取り、学校URLのうち何件を現行slugへ301できるかを集計する（読み取りのみ）。
 *
 * 使い方:
 *   npm run seo:legacy-slugs -- "C:\path\to\表.csv"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from '../lib/utils';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  name_normalized: string | null;
  slug: string | null;
  status: string | null;
  is_public: boolean | null;
};

type Resolution = {
  from: string;
  to: string;
  reason: 'slug_history' | 'school_name' | 'active_slug' | 'merged_slug' | 'alias';
};

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function csvRows(filePath: string): string[] {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstComma = line.indexOf(',');
      const rawUrl = firstComma === -1 ? line : line.slice(0, firstComma);
      return rawUrl.replace(/^"|"$/g, '');
    })
    .filter(Boolean);
}

function extractSchoolSlug(url: string): { slug: string; isReviews: boolean } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const prefix = '/tsushin-kuchikomi/schools/';
  if (!parsed.pathname.startsWith(prefix)) return null;
  const rest = parsed.pathname.slice(prefix.length);
  if (!rest || rest.includes('/prefecture/')) return null;

  if (rest.endsWith('/reviews')) {
    const slug = rest.slice(0, -'/reviews'.length);
    return slug ? { slug: decodeSegment(slug), isReviews: true } : null;
  }

  if (rest.includes('/')) return null;
  return { slug: decodeSegment(rest), isReviews: false };
}

function isActivePublic(school: SchoolRow | undefined): boolean {
  return Boolean(school?.slug && school.status === 'active' && school.is_public === true);
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('CSVパスを指定してください: npm run seo:legacy-slugs -- "C:\\path\\to\\表.csv"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const [{ data: schools, error: schoolsError }, { data: aliases, error: aliasesError }] =
    await Promise.all([
      supabase.from('schools').select('id, name, name_normalized, slug, status, is_public'),
      supabase.from('school_aliases').select('school_id, alias_normalized'),
    ]);

  if (schoolsError) throw schoolsError;
  if (aliasesError) throw aliasesError;

  const schoolRows = (schools ?? []) as SchoolRow[];
  const byId = new Map(schoolRows.map((school) => [school.id, school]));
  const bySlug = new Map(schoolRows.filter((s) => s.slug).map((school) => [school.slug!, school]));
  const activeByNameNorm = new Map(
    schoolRows
      .filter(isActivePublic)
      .map((school) => [school.name_normalized || normalizeText(school.name), school])
  );
  const aliasTargetsByNorm = new Map<string, string[]>();
  for (const row of (aliases as Array<{ school_id: string | null; alias_normalized: string | null }> | null) ?? []) {
    if (!row.school_id || !row.alias_normalized) continue;
    const list = aliasTargetsByNorm.get(row.alias_normalized) ?? [];
    list.push(row.school_id);
    aliasTargetsByNorm.set(row.alias_normalized, list);
  }

  const historyByOldSlug = new Map<string, string>();
  const { data: histories, error: historyError } = await supabase
    .from('school_slug_history')
    .select('old_slug, school_id');
  if (!historyError) {
    for (const row of (histories as Array<{ old_slug: string | null; school_id: string | null }> | null) ?? []) {
      if (row.old_slug && row.school_id) historyByOldSlug.set(row.old_slug, row.school_id);
    }
  }

  const schoolUrls = csvRows(csvPath).map(extractSchoolSlug).filter((row): row is { slug: string; isReviews: boolean } => Boolean(row));
  const resolutions: Resolution[] = [];
  const unresolved: string[] = [];

  for (const row of schoolUrls) {
    const historyTargetId = historyByOldSlug.get(row.slug);
    const historyTarget = historyTargetId ? byId.get(historyTargetId) : undefined;
    if (isActivePublic(historyTarget)) {
      resolutions.push({ from: row.slug, to: historyTarget!.slug!, reason: 'slug_history' });
      continue;
    }

    const nameTarget = activeByNameNorm.get(normalizeText(row.slug));
    if (isActivePublic(nameTarget)) {
      resolutions.push({ from: row.slug, to: nameTarget!.slug!, reason: 'school_name' });
      continue;
    }

    const exact = bySlug.get(row.slug);
    if (isActivePublic(exact)) {
      resolutions.push({ from: row.slug, to: exact!.slug!, reason: 'active_slug' });
      continue;
    }
    if (exact?.status === 'merged') {
      const targets = aliasTargetsByNorm.get(exact.name_normalized || normalizeText(exact.name)) ?? [];
      const target = targets.map((id) => byId.get(id)).find(isActivePublic);
      if (target) {
        resolutions.push({ from: row.slug, to: target.slug!, reason: 'merged_slug' });
        continue;
      }
    }

    const aliasTargets = aliasTargetsByNorm.get(normalizeText(row.slug)) ?? [];
    const aliasTarget = aliasTargets.map((id) => byId.get(id)).find(isActivePublic);
    if (aliasTarget) {
      resolutions.push({ from: row.slug, to: aliasTarget.slug!, reason: 'alias' });
      continue;
    }

    unresolved.push(row.slug);
  }

  const byReason = resolutions.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        total_urls_in_csv: csvRows(csvPath).length,
        school_urls: schoolUrls.length,
        resolvable: resolutions.length,
        unresolved: unresolved.length,
        by_reason: byReason,
        samples: {
          resolvable: resolutions.slice(0, 20),
          unresolved: unresolved.slice(0, 20),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
