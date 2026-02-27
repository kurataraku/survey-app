/**
 * CSVをUTF-8（BOM付き）で書き直す
 * 使い方:
 *   npx tsx scripts/fix-csv-utf8bom.ts
 *   → プロジェクト直下の path.txt に書かれたCSVパスを読み、同じフォルダに _utf8bom.csv を出力
 * または: CSVを import_to_fix.csv にコピーして実行 → import_fixed_utf8bom.csv ができる
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';

const projectRoot = join(__dirname, '..');
const pathFile = join(projectRoot, 'path.txt');
const defaultInput = join(projectRoot, 'import_to_fix.csv');

let inputPath: string;
if (existsSync(pathFile)) {
  inputPath = readFileSync(pathFile, 'utf8').trim();
} else {
  inputPath = defaultInput;
}

const outputPath = existsSync(pathFile)
  ? join(dirname(inputPath), basename(inputPath).replace(/\.csv$/i, '_utf8bom.csv'))
  : join(projectRoot, 'import_fixed_utf8bom.csv');

if (!existsSync(inputPath)) {
  console.error('入力ファイルが見つかりません:', inputPath);
  console.error('path.txt にCSVのフルパスを1行で書くか、CSVを import_to_fix.csv としてプロジェクト直下に置いてください。');
  process.exit(1);
}

const content = readFileSync(inputPath, 'utf8');
const body = content.replace(/^\uFEFF/, '');
const bom = Buffer.from([0xef, 0xbb, 0xbf]);
writeFileSync(outputPath, Buffer.concat([bom, Buffer.from(body, 'utf8')]));
console.log('出力しました:', outputPath);
