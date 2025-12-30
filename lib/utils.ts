/**
 * ユーティリティ関数
 */

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






