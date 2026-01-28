/**
 * このアプリのベースパス。
 * トップ = /tsushin-kuchikomi（会社トップ / は後で差し替え）
 * rewrites で /tsushin-kuchikomi -> / にマッピング。
 */
export const BASE_PATH = "/tsushin-kuchikomi";

export function getApiBase(): string {
  return BASE_PATH;
}

/** API 用パス（fetch の URL）。例: /api/home -> /tsushin-kuchikomi/api/home */
export function apiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}

/** ページ用パス（Link href / router.push）。例: / -> /tsushin-kuchikomi, /schools -> /tsushin-kuchikomi/schools */
export function appPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return BASE_PATH;
  return BASE_PATH + p;
}
