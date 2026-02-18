/**
 * SSR整合性検証スクリプト
 * Client版コンポーネントが誤って使われていないか確認し、SSR戻りを防ぐ
 * 実行: npx ts-node scripts/verify-ssr.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const APP_DIR = path.join(__dirname, '..', 'app', '(survey)');

const FORBIDDEN_PATTERNS: { pattern: RegExp; required: RegExp; msg: string }[] = [
  {
    pattern: /import\s+ReviewCard\s+from/,
    required: /import\s+ReviewCardServer\s+from/,
    msg: 'ReviewCard(Client)の使用禁止。ReviewCardServerを使用してください。',
  },
  {
    pattern: /<ReviewCard\s/,
    required: /<ReviewCardServer\s/,
    msg: 'ReviewCard(Client)の使用禁止。ReviewCardServerを使用してください。',
  },
  {
    pattern: /import\s+SchoolCard\s+from/,
    required: /import\s+SchoolCardServer\s+from/,
    msg: 'SchoolCard(Client)の使用禁止。SchoolCardServerを使用してください。',
  },
  {
    pattern: /<SchoolCard\s/,
    required: /<SchoolCardServer\s/,
    msg: 'SchoolCard(Client)の使用禁止。SchoolCardServerを使用してください。',
  },
  {
    pattern: /import\s+ArticleCard\s+from/,
    required: /import\s+ArticleCardServer\s+from/,
    msg: 'ArticleCard(Client)の使用禁止。ArticleCardServerを使用してください。',
  },
  {
    pattern: /<ArticleCard\s/,
    required: /<ArticleCardServer\s/,
    msg: 'ArticleCard(Client)の使用禁止。ArticleCardServerを使用してください。',
  },
  {
    pattern: /import\s+RankingCard\s+from/,
    required: /import\s+RankingCardServer\s+from/,
    msg: 'RankingCard(Client)の使用禁止。RankingCardServerを使用してください。',
  },
  {
    pattern: /<RankingCard\s/,
    required: /<RankingCardServer\s/,
    msg: 'RankingCard(Client)の使用禁止。RankingCardServerを使用してください。',
  },
];

function walkDir(dir: string, ext: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        files.push(...walkDir(full, ext));
      }
    } else if (entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

let hasError = false;
for (const file of walkDir(APP_DIR, '.tsx')) {
  const content = fs.readFileSync(file, 'utf-8');
  const rel = path.relative(path.join(__dirname, '..'), file);
  for (const { pattern, required, msg } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content) && !required.test(content)) {
      console.error(`[SSR検証エラー] ${rel}: ${msg}`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('\nSSR整合性チェックに失敗しました。上記のClientコンポーネントをServer版に置き換えてください。');
  process.exit(1);
}
console.log('SSR整合性チェックOK');
process.exit(0);
