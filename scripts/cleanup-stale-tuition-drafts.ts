/**
 * 公開時に draft へ降格した残骸を rejected に片付ける（既存データ用）。
 * 公開中より updated_at が古い draft だけが対象。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { resolveSupportFundBasis } from '@/lib/tuition/format';
import type { PublicTuitionEstimate } from '@/lib/types/tuition';

async function main() {
  const apply = process.argv.includes('--apply');
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: published } = await s
    .from('school_tuition_estimates')
    .select('id, school_id, updated_at, plans, first_year_min')
    .eq('status', 'published');

  const lines: string[] = [];
  let cleaned = 0;

  for (const pub of published ?? []) {
    const { data: drafts } = await s
      .from('school_tuition_estimates')
      .select('id, updated_at, plans, first_year_min')
      .eq('school_id', pub.school_id)
      .eq('status', 'draft');

    for (const d of drafts ?? []) {
      if (
        !d.updated_at ||
        !pub.updated_at ||
        new Date(d.updated_at).getTime() > new Date(pub.updated_at).getTime()
      ) {
        continue;
      }
      const { data: school } = await s
        .from('schools')
        .select('name')
        .eq('id', pub.school_id)
        .maybeSingle();
      const pBasis = resolveSupportFundBasis(pub as unknown as PublicTuitionEstimate);
      const dBasis = resolveSupportFundBasis(d as unknown as PublicTuitionEstimate);
      lines.push(
        `${school?.name}: draft(${dBasis}) → rejected / published残す(${pBasis})`
      );
      cleaned++;
      if (apply) {
        await s
          .from('school_tuition_estimates')
          .update({ status: 'rejected' })
          .eq('id', d.id);
      }
    }
  }

  lines.push(`\n片付け対象: ${cleaned}件 ${apply ? '(適用済み)' : '(dry-run)'}`);
  fs.writeFileSync('.seo/cleanup-drafts.txt', lines.join('\n'), 'utf8');
  console.log('ok');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
