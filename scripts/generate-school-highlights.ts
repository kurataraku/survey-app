/**
 * 全校の schools.highlights を OpenAI で生成して Supabase に保存する CLI
 *
 * 使い方:
 *   npx tsx scripts/generate-school-highlights.ts --dry-run --limit=5
 *   npx tsx scripts/generate-school-highlights.ts --limit=20 --sleep-ms=200
 *   npx tsx scripts/generate-school-highlights.ts --all --sleep-ms=150
 *   npx tsx scripts/generate-school-highlights.ts --all --force --sleep-ms=150  # 既存上書き
 *
 * 環境: .env.local に OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * モデル: OPENAI_MODEL（未設定時は gpt-4o-mini）
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  intro: string | null;
  highlights: unknown;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    force: argv.includes('--force'),
    limit: (() => {
      const a = argv.find((x) => x.startsWith('--limit='));
      if (!a) return null;
      const n = parseInt(a.split('=')[1], 10);
      return Number.isFinite(n) ? n : null;
    })(),
    sleepMs: (() => {
      const a = argv.find((x) => x.startsWith('--sleep-ms='));
      if (!a) return 0;
      const n = parseInt(a.split('=')[1], 10);
      return Number.isFinite(n) ? n : 0;
    })(),
  };
}

function hasNonemptyHighlights(highlights: unknown): boolean {
  if (!Array.isArray(highlights)) return false;
  return highlights.some((h) => typeof h === 'string' && h.trim() !== '');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const SYSTEM_PROMPT = `あなたは日本の「通信制高等学校」比較サイトの編集者です。
与えられた学校名・所在地・紹介文だけを根拠に、JSONで highlights 配列を返します。

厳守ルール:
1. 紹介文に書かれている事実・表現からだけ特徴を抽出する。紹介に無いプログラム・学費・ランキング・評判の断定は書かない。
2. 各要素は比較用の短い名詞句（だいたい6〜18文字、最大22文字）。句読点・絵文字なし。
3. 4〜6個。重複禁止。抽象すぎる「良い学校」等は禁止。
4. 「おすすめ」「人気No.1」「評判が良い」など根拠のない宣伝文句は禁止。
5. 紹介文が非常に短い・乏しい場合は、紹介から拾える語だけに加え、虚偽にならない程度の一般表現（例: 通信制の高等学校、学習形態は公式で確認）に限定する。一般表現は最大2個まで。
6. 出力は JSON オブジェクト1つだけ。キー名は highlights（配列の文字列）。
7. 次の語をタグに含めないこと: 「公式情報未確認」「公式情報は未確認」「要確認」「不明」「名称不明確」「所在地不明確」「複数校混在」など、ユーザーに価値を伝えないメタ文言。`;

function buildGenericFallbackHighlights(school: SchoolRow): string[] {
  const tags: string[] = ["通信制の高等学校", "高等学校卒業資格の課程"];
  const p = school.prefecture?.trim();
  if (p && p !== "不明") tags.push(`${p}に所在`);
  else tags.push("在籍地域は入学要項で確認");
  tags.push("学習形態は公式サイトで確認");
  return tags.slice(0, 5);
}

async function fetchTargetSchools(
  supabase: SupabaseClient,
  opts: { force: boolean; all: boolean; limit: number | null }
): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const out: SchoolRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, intro, highlights')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as SchoolRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let rows = out;
  if (!opts.force) {
    rows = rows.filter((s) => !hasNonemptyHighlights(s.highlights));
  }
  if (!opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }
  if (opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }
  return rows;
}

function normalizeHighlights(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x !== '')
    .map((x) => (x.length > 22 ? x.slice(0, 22) : x));
  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const h of cleaned) {
    const k = h.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(h);
  }
  if (dedup.length < 3) return null;
  if (dedup.length > 8) return dedup.slice(0, 8);
  return dedup.slice(0, 6);
}

async function generateHighlights(
  openai: OpenAI,
  model: string,
  school: SchoolRow
): Promise<string[] | null> {
  const intro = (school.intro ?? '').trim();
  const user = `学校名: ${school.name}
主たる所在地（マスター）: ${school.prefecture ?? '（未設定）'}

紹介文（サイト掲載）:
---
${intro || '（なし）'}
---

上記に基づき、highlights 配列（文字列4〜6個）をJSONで返してください。`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
      });

      const text = res.choices[0]?.message?.content?.trim();
      if (!text) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      const arr = (parsed as { highlights?: unknown }).highlights;
      const normalized = normalizeHighlights(arr);
      if (normalized) return normalized;
      await sleep(1500 * (attempt + 1));
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  const args = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }
  if (!openaiKey) {
    console.error('OPENAI_API_KEY が必要です');
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openai = new OpenAI({ apiKey: openaiKey });
  const supabase = createClient(url, key);

  if (!args.all && args.limit == null) {
    console.error(
      '使い方: --all または --limit=N を指定してください（安全のため --dry-run 推奨で試験）\n' +
        '例: npx tsx scripts/generate-school-highlights.ts --dry-run --limit=3\n' +
        '例: npx tsx scripts/generate-school-highlights.ts --all --sleep-ms=150'
    );
    process.exit(1);
  }

  const schools = await fetchTargetSchools(supabase, {
    force: args.force,
    all: args.all,
    limit: args.limit,
  });

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        model,
        target_count: schools.length,
        force: args.force,
      },
      null,
      2
    )
  );

  let ok = 0;
  let skip = 0;
  let err = 0;

  for (let i = 0; i < schools.length; i++) {
    const s = schools[i];
    try {
      const aiHighlights = await generateHighlights(openai, model, s);
      const highlights = aiHighlights ?? buildGenericFallbackHighlights(s);
      if (!highlights.length) {
        console.warn(`[${i + 1}/${s.name}] SKIP: フォールバックも空`);
        skip++;
        continue;
      }
      if (args.dryRun) {
        const tag = aiHighlights ? 'DRY' : 'DRY+FALLBACK';
        console.log(`[${tag}] ${s.name}: ${JSON.stringify(highlights)}`);
        ok++;
      } else {
        const { error } = await supabase.from('schools').update({ highlights }).eq('id', s.id);
        if (error) throw error;
        const tag = aiHighlights ? 'OK' : 'OK+FALLBACK';
        console.log(`[${tag}] ${s.name}: ${JSON.stringify(highlights)}`);
        ok++;
      }
    } catch (e) {
      err++;
      console.error(`[ERR] ${s.name}:`, e instanceof Error ? e.message : e);
    }
    if (args.sleepMs > 0 && i < schools.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        ok,
        skip,
        err,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
