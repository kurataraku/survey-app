/**
 * 初期オーナー作成スクリプト
 * 
 * 使用方法:
 * 1. 環境変数 ADMIN_OWNER_EMAIL にメールアドレスを設定
 * 2. npm run setup:initial-owner を実行
 * 
 * 機能:
 * - Supabase Authでユーザーを招待（メール招待リンクを送信）
 * - admin_usersテーブルに role='owner' で登録
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

async function setupInitialOwner() {
  console.log('🚀 初期オーナー作成を開始します...');
  console.log(`   メールアドレス: ${normalizedEmail}`);

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  try {
    // 1. 既存のadmin_usersをチェック
    const { data: existingAdmins, error: checkError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', normalizedEmail);

    if (checkError) {
      console.error('❌ エラー: admin_usersテーブルの確認に失敗しました');
      console.error('   詳細:', checkError.message);
      console.error('   ヒント: supabase-migrations/create-admin-users.sql を実行しましたか？');
      process.exit(1);
    }

    if (existingAdmins && existingAdmins.length > 0) {
      const existingAdmin = existingAdmins[0];
      console.log('⚠️  警告: このメールアドレスは既に管理者として登録されています');
      console.log(`   現在の状態: role=${existingAdmin.role}, is_active=${existingAdmin.is_active}`);
      
      if (existingAdmin.role === 'owner' && existingAdmin.is_active) {
        console.log('✅ 既にownerとして有効化されています。処理をスキップします。');
        process.exit(0);
      }
    }

    // 2. Supabase Authでユーザーを招待
    console.log('📧 Supabase Authでユーザーを招待しています...');
    
    // リダイレクトURLを設定（環境変数から取得、デフォルトはlocalhost）
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/admin/login';
    
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          role: 'owner',
        },
        redirectTo: redirectTo,
      }
    );

    if (inviteError) {
      // ユーザーが既に存在する場合でも、admin_usersに登録するだけでもOK
      if (
        inviteError.message?.includes('already registered') ||
        inviteError.message?.includes('already exists') ||
        inviteError.message?.includes('User already registered')
      ) {
        console.log('ℹ️  ユーザーは既にSupabase Authに登録されています。');
        console.log('   admin_usersテーブルにのみ登録します。');
      } else {
        console.error('❌ エラー: ユーザー招待に失敗しました');
        console.error('   詳細:', inviteError.message);
        console.error('   ヒント: Supabaseのメール設定を確認してください');
        process.exit(1);
      }
    } else {
      console.log('✅ 招待メールを送信しました');
    }

    // 3. admin_usersテーブルに登録（既存の場合は更新）
    if (existingAdmins && existingAdmins.length > 0) {
      console.log('📝 admin_usersテーブルを更新しています...');
      const { data: updatedAdmin, error: updateError } = await supabase
        .from('admin_users')
        .update({
          role: 'owner',
          is_active: true,
        })
        .eq('email', normalizedEmail)
        .select()
        .single();

      if (updateError) {
        console.error('❌ エラー: admin_usersテーブルの更新に失敗しました');
        console.error('   詳細:', updateError.message);
        process.exit(1);
      }

      console.log('✅ admin_usersテーブルを更新しました');
      console.log(`   ID: ${updatedAdmin?.id}`);
    } else {
      console.log('📝 admin_usersテーブルに登録しています...');
      const { data: newAdmin, error: insertError } = await supabase
        .from('admin_users')
        .insert({
          email: normalizedEmail,
          role: 'owner',
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ エラー: admin_usersテーブルへの登録に失敗しました');
        console.error('   詳細:', insertError.message);
        console.error('   ヒント: supabase-migrations/create-admin-users.sql を実行しましたか？');
        process.exit(1);
      }

      console.log('✅ admin_usersテーブルに登録しました');
      console.log(`   ID: ${newAdmin?.id}`);
    }

    console.log('');
    console.log('🎉 初期オーナーの作成が完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log(`1. ${normalizedEmail} に送信されたメールを確認してください`);
    console.log('2. メール内のリンクをクリックして、パスワードを設定してください');
    console.log('3. 設定したパスワードで https://your-domain.com/admin/login にログインしてください');
    console.log('');
  } catch (error) {
    console.error('❌ 予期しないエラーが発生しました');
    console.error(error);
    process.exit(1);
  }
}

setupInitialOwner();
