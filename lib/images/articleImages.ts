/** 記事画像を置いている Supabase Storage の公開パス。next.config の images.remotePatterns と共有する */
export const ARTICLE_IMAGE_PATH_PREFIX = '/storage/v1/object/public/';

export function getArticleImageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isOptimizableArticleImage(src: string): boolean {
  const host = getArticleImageHost();
  if (!host) return false;
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      url.hostname === host &&
      url.pathname.startsWith(ARTICLE_IMAGE_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}
