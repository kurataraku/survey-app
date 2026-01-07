/**
 * ユーティリティ関数
 */

/**
 * クラス名をマージする関数（Tailwind用）
 * @param classes - クラス名の配列または文字列
 * @returns マージされたクラス名文字列
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * 全角英数字を半角に変換する関数
 * 検索クエリの正規化に使用
 * 
 * @param text - 変換する文字列
 * @returns 全角英数字が半角に変換された文字列
 * 
 * @example
 * normalizeSearchQuery('Ｎ高') // => 'N高'
 * normalizeSearchQuery('ＡＢＣ123') // => 'ABC123'
 */
export function normalizeSearchQuery(text: string): string {
  if (!text) {
    return '';
  }

  // 全角英数字を半角に変換
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
      const code = char.charCodeAt(0);
      // 全角英数字の範囲を半角に変換
      if (code >= 0xFF21 && code <= 0xFF3A) {
        // 全角大文字A-Z (0xFF21-0xFF3A) → 半角A-Z (0x41-0x5A)
        return String.fromCharCode(code - 0xFEE0);
      } else if (code >= 0xFF41 && code <= 0xFF5A) {
        // 全角小文字a-z (0xFF41-0xFF5A) → 半角a-z (0x61-0x7A)
        return String.fromCharCode(code - 0xFEE0);
      } else if (code >= 0xFF10 && code <= 0xFF19) {
        // 全角数字0-9 (0xFF10-0xFF19) → 半角0-9 (0x30-0x39)
        return String.fromCharCode(code - 0xFEE0);
      }
      return char;
    });
}

/**
 * テキストを正規化する関数（学校名の検索・比較用）
 * NFKC正規化、空白除去、「高等学校」⇄「高校」の統一などを行う
 * 
 * @param text - 正規化する文字列
 * @returns 正規化された文字列
 * 
 * @example
 * normalizeText('Ｎ高等学校') // => 'N高等学校'
 * normalizeText('飛鳥未来　高校') // => '飛鳥未来高校'
 * normalizeText('通信制高等学校') // => '通信制高校'
 */
export function normalizeText(text: string): string {
  if (!text) {
    return '';
  }

  let normalized = text;

  // 1. NFKC正規化（全角・半角の統一、合成文字の分解など）
  // Node.js環境ではString.prototype.normalizeが使用可能
  normalized = normalized.normalize('NFKC');

  // 2. 前後空白をtrim
  normalized = normalized.trim();

  // 3. 全角/半角スペースを除去（連続するスペースも1つに）
  normalized = normalized.replace(/[\s\u3000]+/g, '');

  // 4. 「高等学校」を「高校」に統一
  normalized = normalized.replace(/高等学校/g, '高校');

  // 5. 全角英数字を半角に変換（既存のnormalizeSearchQueryのロジックを使用）
  normalized = normalized
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xFF21 && code <= 0xFF3A) {
        return String.fromCharCode(code - 0xFEE0);
      } else if (code >= 0xFF41 && code <= 0xFF5A) {
        return String.fromCharCode(code - 0xFEE0);
      } else if (code >= 0xFF10 && code <= 0xFF19) {
        return String.fromCharCode(code - 0xFEE0);
      }
      return char;
    });

  return normalized;
}

/**
 * 文字列からslug（URL用のスラッグ）を生成する関数
 * 学校名や記事タイトルなどに使用可能
 * 
 * @param text - スラッグを生成する文字列（学校名、記事タイトルなど）
 * @returns slug（小文字、ハイフン区切り）
 * 
 * @example
 * generateSlug('通信制高校A') // => '通信制高校a'
 * generateSlug('学校名 (正式名称)') // => '学校名-正式名称'
 * generateSlug('記事タイトル') // => '記事タイトル'
 */
export function generateSlug(text: string): string {
  if (!text) {
    return '';
  }

  // 1. 文字列を小文字に変換
  let slug = text.toLowerCase();

  // 2. 英数字、日本語（ひらがな、カタカナ、漢字）以外の文字をハイフンに変換
  slug = slug.replace(/[^a-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '-');

  // 3. 連続するハイフンを1つにまとめる
  slug = slug.replace(/-+/g, '-');

  // 4. 先頭と末尾のハイフンを削除
  slug = slug.replace(/^-+|-+$/g, '');

  // 5. 空文字列の場合は'unknown'を返す
  if (!slug) {
    return 'unknown';
  }

  return slug;
}






