/**
 * パスワードリセットメール送信スクリプト
 * 
 * 使用方法:
 * 1. 環境変数 ADMIN_OWNER_EMAIL にメールアドレスを設定
 * 2. npm run send-password-reset を実行
 * 
 * 機能:
 * - Supabase Authでパスワードリセットメールを送信
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.ADMIN_OWNER_EMAIL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ エラー: Supabase環境変数が設定されていません');
  console.error('   NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

if (!ownerEmail) {
  console.error('❌ エラー: ADMIN_OWNER_EMAIL が設定されていません');
  console.error('   .env.local に ADMIN_OWNER_EMAIL=your-email@example.com を追加してください');
  process.exit(1);
}

const normalizedEmail = ownerEmail.trim().toLowerCase();
const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/admin/login';

async function sendPasswordReset() {
  console.log('🚀 パスワードリセットメール送信を開始します...');
  console.log(`   メールアドレス: ${normalizedEmail}`);
  console.log(`   リダイレクト先: ${redirectTo}`);

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  try {
    // パスワードリセットメールを送信
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('❌ エラー: パスワードリセットメールの送信に失敗しました');
      console.error('   詳細:', error.message);
      
      // ユーザーが存在しない場合
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        console.error('   ヒント: このメールアドレスのユーザーが存在しません');
        console.error('   まず、setup-initial-owner スクリプトを実行してください');
      }
      
      process.exit(1);
    }

    console.log('');
    console.log('✅ パスワードリセットメールを送信しました！');
    console.log('');
    console.log('次のステップ:');
    console.log(`1. ${normalizedEmail} に送信されたメールを確認してください`);
    console.log('2. メール内の「Reset password」リンクをクリックしてください');
    console.log('3. 新しいパスワードを設定してください');
    console.log(`4. 設定したパスワードで ${redirectTo} にログインしてください`);
    console.log('');
    
    // 開発環境の場合、直接リンクを表示（メールが届かない場合の代替手段）
    if (data?.properties?.action_link) {
      console.log('📧 開発用: 直接リンク（メールが届かない場合）:');
      console.log(data.properties.action_link);
      console.log('');
    }
  } catch (error) {
    console.error('❌ 予期しないエラーが発生しました');
    console.error(error);
    process.exit(1);
  }
}

sendPasswordReset();
