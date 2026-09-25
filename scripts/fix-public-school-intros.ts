/**
 * 公立通信制の紹介文を公式情報で埋め、生成時の引用番号・文字数表記を紹介文から除去する。
 *
 * 紹介文は各校公式サイトと愛知県教育委員会・東京都教育委員会の公表内容に書かれている事実だけで構成し、
 * 公式に記載のない項目（学費の総額、進学実績など）は書かない。
 *
 * 出典（確認日 2026-09-25）
 *   佐屋: https://saya-h.aichi-c.ed.jp/cms/info/page-1383.html
 *   武豊: https://taketoyo-h.aichi-c.ed.jp/cms/page-2524.html
 *   豊野: https://yutakano-h.aichi-c.ed.jp/tsuushin.html
 *   御津あおば: https://mitoaoba-h.aichi-c.ed.jp/wp-content/uploads/2024/10/通信制について.pdf
 *   愛知県共通: https://www.pref.aichi.jp/soshiki/kotogakko/0000027113.html
 *   一橋: https://www.metro.ed.jp/hitotsubashi-hc/our_school/feature.html
 *         https://www.metro.ed.jp/hitotsubashi-hc/guide/qanda.html
 *
 * 使い方: npx tsx scripts/fix-public-school-intros.ts [--apply]
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const INTROS: Record<string, string> = {
  'saya-koukou-kuchikomi':
    '愛知県立佐屋高等学校の通信制課程（普通科）は、2025年度に始まった愛知県の「フレキシブルハイスクール」の1校で、全日制（農業科・家庭科）と昼間定時制を同じ学校に併置しています。所在地は愛西市東條町。学習はレポート・スクーリング・テストが基本で、スクーリングは平日に行います。3年以上在籍して74単位以上を修得し、特別活動に30時間以上参加すると卒業でき、全日制・昼間定時制の授業を受ける校内併修も一部可能です。1学年の募集定員は40名です。',
  'taketoyo-koukou-kuchikomi':
    '愛知県立武豊高等学校の通信制課程は、2025年度に始まったフレキシブルハイスクールとして全日制・昼間定時制と併置された、知多地区の県立高校で唯一の通信制です。所在地は知多郡武豊町。週2回・月4回程度登校してスクーリング（1コマ50分）を受け、レポートはオンラインで提出します。1年間の履修は19単位が基本のため卒業は原則4年ですが、全日制の授業を受ける併修により3年での卒業を目指すこともできます。家庭学習用のタブレット端末は各自で用意します。',
  'yutakano-koukou-kuchikomi':
    '愛知県立豊野高等学校の通信制課程は、2025年度に始まったフレキシブルハイスクールとして、全日制・昼間定時制と同じ学校に置かれています。所在地は豊田市渡刈町で、最寄りは愛知環状鉄道の末野原駅です。スクーリングは平日に行い、水曜と木曜の登校を予定しています（授業は10時55分から）。3年以上在籍して74単位以上を修得すると卒業でき、在籍する課程を変える転籍や、他の課程の授業を受ける併修の仕組みもあります。',
  'mitoaoba-koukou-kuchikomi':
    '愛知県立御津あおば高等学校の通信制課程は、2025年度に始まったフレキシブルハイスクールとして、全日制・昼間定時制と併置されています。所在地は豊川市御津町。スクーリングは平日に年間16週（週2日）設定され、1科目1回50分の授業形式で行います。レポートは電子上で提出・返却するため、タブレット等の端末とタッチペンが必要です。1年間に受講できる科目は1年次が最大19単位、2年次以降が最大30単位で、入学の翌年度以降は条件を満たせば全日制・昼間定時制へ転籍できます。',
  'hitotsubashi-koukou-kuchikomi':
    '東京都立一橋高等学校の通信制課程は、千代田区にある都立の通信制高校です。自宅での自学自習が基本で、レポートを期限内にすべて提出して合格すること、土曜日に行うスクーリングに規定回数以上出席すること、前期・後期の試験に合格することの3つで単位を修得します。スクーリングの出席回数は科目ごとに決まっており、年度初めに配られる年間時間割から自分で出席日を組み立てます。前期のスクーリングの一部をNHK高校講座の視聴と報告書で代える「Web学習コース」もあります。',
};

const CITATION = /\[\d+\](?:\[\d+\])*/g;
const CHAR_COUNT = /[（(]\d+字[）)]/g;

function stripArtifacts(intro: string): string {
  return intro.replace(CITATION, '').replace(CHAR_COUNT, '').replace(/[ \t]+$/gm, '').trim();
}

async function main() {
  const { data, error } = await sb.from('schools').select('id,name,slug,intro');
  if (error) throw error;
  const now = new Date().toISOString();
  let changed = 0;

  for (const school of data ?? []) {
    const current = (school.intro as string | null) ?? '';
    const next = INTROS[school.slug] ?? (current ? stripArtifacts(current) : '');
    if (!next || next === current) continue;

    changed += 1;
    const kind = INTROS[school.slug] ? (current ? '書き直し' : '新規') : '引用番号除去';
    console.log(`[${kind}] ${school.name}`);
    if (APPLY) {
      const { error: updateError } = await sb
        .from('schools')
        .update({ intro: next, updated_at: now })
        .eq('id', school.id);
      if (updateError) throw updateError;
    }
  }

  const missing = Object.keys(INTROS).filter((slug) => !(data ?? []).some((s) => s.slug === slug));
  if (missing.length) console.log('見つからないslug:', missing.join(', '));
  console.log(`${APPLY ? '更新' : '更新予定（--apply で反映）'}: ${changed}件`);
}

main();
