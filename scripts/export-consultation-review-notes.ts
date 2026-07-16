import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sinceArg = process.argv.find((arg) => arg.startsWith('--since='));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));

const since = sinceArg?.replace('--since=', '') || '2026-07-14T15:00:00.000Z';
const limit = Math.min(Number.parseInt(limitArg?.replace('--limit=', '') || '200', 10) || 200, 500);

type ConsultationReviewNoteRow = {
  id: string;
  created_at: string | null;
  user_question: string | null;
  assistant_reply: string | null;
  intent: string | null;
  focus_label: string | null;
  prefecture: string | null;
  reason_group: string | null;
  rag_doc_count: number | null;
  status: string | null;
  review_notes: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n').trim();
}

function toMarkdown(rows: ConsultationReviewNoteRow[]): string {
  const header = [
    '# 相談AIレビュー済みメモ',
    '',
    `- since: ${since}`,
    `- exported_at: ${new Date().toISOString()}`,
    `- count: ${rows.length}`,
    '',
  ].join('\n');

  const body = rows
    .map((row, index) => {
      const meta = [
        row.intent ? `intent=${row.intent}` : null,
        row.focus_label ? `focus=${row.focus_label}` : null,
        row.prefecture ? `prefecture=${row.prefecture}` : null,
        row.reason_group ? `reason=${row.reason_group}` : null,
        typeof row.rag_doc_count === 'number' ? `rag_docs=${row.rag_doc_count}` : null,
        row.status ? `status=${row.status}` : null,
      ]
        .filter((item): item is string => Boolean(item))
        .join(' / ');

      return [
        `## ${index + 1}. ${row.created_at ?? 'created_atなし'} ${meta ? `(${meta})` : ''}`,
        '',
        '### ユーザー質問',
        normalize(row.user_question) || '（なし）',
        '',
        '### AI回答',
        normalize(row.assistant_reply) || '（なし）',
        '',
        '### レビューメモ',
        normalize(row.review_notes) || '（なし）',
        '',
      ].join('\n');
    })
    .join('\n---\n\n');

  return `${header}${body}\n`;
}

async function main() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。');
    console.error('.env.local に設定するか、環境変数として渡してください。');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('consultation_chat_logs')
    .select(
      'id,created_at,user_question,assistant_reply,intent,focus_label,prefecture,reason_group,rag_doc_count,status,review_notes'
    )
    .eq('is_reviewed', true)
    .not('review_notes', 'is', null)
    .neq('review_notes', '')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('相談AIレビュー済みメモの取得に失敗しました:', error);
    process.exit(1);
  }

  const rows = (data ?? []) as ConsultationReviewNoteRow[];
  const outputDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `consultation-review-notes-${stamp}.json`);
  const mdPath = path.join(outputDir, `consultation-review-notes-${stamp}.md`);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        since,
        exported_at: new Date().toISOString(),
        count: rows.length,
        rows,
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(mdPath, toMarkdown(rows), 'utf8');

  console.log(`Exported ${rows.length} review notes.`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
