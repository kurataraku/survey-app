/**
 * 環境変数の確認スクリプト
 * 開発環境と本番環境で環境変数が正しく設定されているか確認
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む（ローカル環境の場合）
config({ path: resolve(process.cwd(), '.env.local') });

console.log('=== 環境変数の確認 ===\n');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
];

let allSet = true;

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // 機密情報は一部のみ表示
    if (varName.includes('KEY')) {
      const masked = value.length > 20 
        ? `${value.substring(0, 20)}...（${value.length}文字）`
        : '***（機密情報）';
      console.log(`✅ ${varName}: ${masked}`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未設定`);
    allSet = false;
  }
});

console.log('\n=== 詳細確認 ===');

// Supabase URLの確認
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
if (supabaseUrl) {
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    console.log('⚠️ 警告: Supabase URLにlocalhostが含まれています（開発環境用の可能性）');
  } else if (supabaseUrl.includes('.supabase.co')) {
    console.log('✅ Supabase URLの形式が正しいです');
  } else {
    console.log('⚠️ 警告: Supabase URLの形式が正しくない可能性があります');
  }
}

// Site URLの確認
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
if (siteUrl) {
  if (siteUrl === 'https://example.com') {
    console.log('⚠️ 警告: NEXT_PUBLIC_SITE_URLがデフォルト値のままです。本番環境では実際のドメインを設定してください');
  } else if (siteUrl.includes('localhost')) {
    console.log('ℹ️ 開発環境: localhostが設定されています（開発環境では問題ありません）');
  } else {
    console.log('✅ Site URLが設定されています');
  }
}

// 本番環境のチェック
const env = process.env.NODE_ENV || process.env.VERCEL_ENV || 'development';
console.log(`\n現在の環境: ${env}`);

if (env === 'production') {
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    console.log('\n❌ エラー: 本番環境で開発用のSupabase URLが設定されています');
    console.log('   NEXT_PUBLIC_SUPABASE_URL を本番環境のURLに変更してください');
    allSet = false;
  }
  
  if (siteUrl === 'https://example.com' || siteUrl.includes('localhost')) {
    console.log('\n⚠️ 警告: 本番環境でNEXT_PUBLIC_SITE_URLが正しく設定されていません');
    console.log('   実際のドメイン（例: https://yourdomain.com）を設定してください');
  }
}

console.log('\n=== 確認結果 ===');
if (allSet) {
  console.log('✅ すべての必須環境変数が設定されています');
  process.exit(0);
} else {
  console.log('❌ 一部の環境変数が設定されていません');
  console.log('\n設定方法:');
  console.log('1. ローカル環境: .env.localファイルを作成');
  console.log('2. 本番環境（Vercel）: Settings → Environment Variables で設定');
  process.exit(1);
}
