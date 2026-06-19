import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const SESSION_ID = `verify-utf8-${Date.now()}`;

async function main() {
  const response = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '不登校の子に合う通信制高校の選び方を教えてください（UTF-8検証）' }],
      session_id: SESSION_ID,
      source: 'verify_utf8',
      page_url: `${BASE}/consultation-ai`,
    }),
  });

  const json = (await response.json()) as { reply?: string; error?: string };
  console.log('chat status:', response.status);
  console.log('reply preview:', (json.reply ?? json.error ?? '').slice(0, 120));

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from('consultation_chat_logs')
    .select('id, user_question, status, intent, focus_label, rag_doc_count')
    .eq('session_id', SESSION_ID)
    .maybeSingle();

  if (error || !data) {
    console.error('ログ取得失敗:', error);
    process.exit(1);
  }

  console.log('logged:', data);

  const page = await fetch(`${BASE}/admin/consultation-chats`, { redirect: 'manual' });
  console.log('admin page status:', page.status, '(302/307=ログインへリダイレクト想定)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
