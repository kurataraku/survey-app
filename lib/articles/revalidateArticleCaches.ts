import { revalidatePath } from 'next/cache';
import { BASE_PATH } from '@/lib/base-path';

/**
 * rewrite 前（アプリ内部）と rewrite 後（公開URL）の両方を無効化する。
 * /tsushin-kuchikomi/features/* は beforeFiles で /features/* に流れるため、
 * 内部パスだけ revalidate すると CDN 上の公開パスが古いまま残ることがある。
 */
function pathsForArticleSlug(slug: string): string[] {
  const encoded = encodeURIComponent(slug);
  return [
    `/features/${encoded}`,
    `${BASE_PATH}/features/${encoded}`,
  ];
}

const FEATURES_LIST_PATHS = ['/features', `${BASE_PATH}/features`] as const;
const HOME_PATHS = ['/', BASE_PATH] as const;

function revalidatePaths(paths: readonly string[], type: 'layout' | 'page'): void {
  for (const path of paths) {
    revalidatePath(path, type);
  }
}

/**
 * 記事更新・作成後に ISR / Full Route Cache を無効化する。
 * features/[slug] は revalidate=3600 のため、保存直後に反映されない問題を防ぐ。
 */
export function revalidateArticleCaches(
  slug: string,
  options?: { previousSlug?: string | null }
): void {
  const prev = options?.previousSlug?.trim();
  const next = slug.trim();
  if (!next) return;

  const slugsToInvalidate = new Set<string>([next]);
  if (prev && prev !== next) {
    slugsToInvalidate.add(prev);
  }

  for (const s of slugsToInvalidate) {
    const articlePaths = pathsForArticleSlug(s);
    revalidatePaths(articlePaths, 'page');
    revalidatePaths(articlePaths, 'layout');
  }

  revalidatePaths(FEATURES_LIST_PATHS, 'layout');
  revalidatePaths(HOME_PATHS, 'layout');
}
