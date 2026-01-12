/**
 * パスワード直接設定スクリプト
 * 
 * 使用方法:
 * 1. 環境変数 ADMIN_OWNER_EMAIL と ADMIN_OWNER_PASSWORD を設定
 * 2. npm run set-password-directly を実行
 * 
 * 機能:
 * - Supabase Authでユーザーのパスワードを直接設定（Service Role Keyを使用）
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// .env.localを読み込む
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.ADMIN_OWNER_EMAIL;
const ownerPassword = process.env.ADMIN_OWNER_PASSWORD;

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

async function setPasswordDirectly() {
  console.log('🚀 パスワード直接設定を開始します...');
  console.log(`   メールアドレス: ${normalizedEmail}`);

  // パスワードを取得（環境変数または対話的に）
  let password = ownerPassword;
  
  if (!password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    password = await new Promise<string>((resolve) => {
      rl.question('パスワードを入力してください（8文字以上）: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });

    if (!password || password.length < 8) {
      console.error('❌ エラー: パスワードは8文字以上である必要があります');
      process.exit(1);
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. ユーザーを取得
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ エラー: ユーザー一覧の取得に失敗しました');
      console.error('   詳細:', listError.message);
      process.exit(1);
    }

    const user = users?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      console.error('❌ エラー: このメールアドレスのユーザーが見つかりません');
      console.error('   ヒント: まず、setup-initial-owner スクリプトを実行してください');
      process.exit(1);
    }

    console.log(`✅ ユーザーが見つかりました: ${user.email}`);

    // 2. パスワードを直接更新
    console.log('🔐 パスワードを設定しています...');
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: password,
      }
    );

    if (updateError) {
      console.error('❌ エラー: パスワードの設定に失敗しました');
      console.error('   詳細:', updateError.message);
      process.exit(1);
    }

    console.log('');
    console.log('🎉 パスワードの設定が完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. ブラウザで http://localhost:3000/admin/login にアクセス');
    console.log(`2. メールアドレス: ${normalizedEmail}`);
    console.log('3. 設定したパスワードでログイン');
    console.log('');
  } catch (error) {
    console.error('❌ 予期しないエラーが発生しました');
    console.error(error);
    process.exit(1);
  }
}

setPasswordDirectly();
