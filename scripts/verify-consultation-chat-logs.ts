import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const probe = await supabase.from('consultation_chat_logs').select('id').limit(1);

  if (probe.error) {
    const code = probe.error.code ?? '';
    const message = probe.error.message ?? '';
    if (code === 'PGRST205' || message.includes('Could not find the table')) {
      console.log('テーブル未作成: consultation_chat_logs');
      console.log('Supabase SQL Editor で以下を実行してください:');
      console.log('  supabase-migrations/create-consultation-chat-logs.sql');
      process.exit(2);
    }
    console.error('テーブル確認エラー:', probe.error);
    process.exit(1);
  }

  console.log('OK: consultation_chat_logs テーブルは存在します');

  const testQuestion = `[verify] ${new Date().toISOString()}`;
  const insert = await supabase
    .from('consultation_chat_logs')
    .insert({
      session_id: 'verify-script',
      source: 'verify_script',
      user_question: testQuestion,
      assistant_reply: '検証用のテスト回答です。',
      intent: 'general_advice',
      status: 'success',
      rag_doc_count: 0,
    })
    .select('id, created_at, user_question, status')
    .single();

  if (insert.error) {
    console.error('INSERT検証エラー:', insert.error);
    process.exit(1);
  }

  console.log('OK: テストログをINSERTしました', insert.data);

  const listed = await supabase
    .from('consultation_chat_logs')
    .select('id, user_question, created_at')
    .eq('id', insert.data.id)
    .single();

  if (listed.error || !listed.data) {
    console.error('SELECT検証エラー:', listed.error);
    process.exit(1);
  }

  console.log('OK: テストログをSELECTしました', listed.data);

  const removed = await supabase.from('consultation_chat_logs').delete().eq('id', insert.data.id);
  if (removed.error) {
    console.warn('テストログ削除に失敗（手動削除してください）:', removed.error);
  } else {
    console.log('OK: テストログを削除しました');
  }

  const migrationPath = path.join(
    process.cwd(),
    'supabase-migrations',
    'create-consultation-chat-logs.sql'
  );
  if (fs.existsSync(migrationPath)) {
    console.log(`マイグレーションファイル: ${migrationPath}`);
  }

  console.log('\n次の確認:');
  console.log('1. npm run dev で開発サーバー起動');
  console.log('2. 相談AIで質問を送信');
  console.log('3. 管理画面 /admin/consultation-chats でログ確認');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
