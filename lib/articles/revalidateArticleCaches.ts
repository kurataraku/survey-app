import { revalidatePath } from 'next/cache';

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

  if (prev && prev !== next) {
    revalidatePath(`/features/${prev}`, 'layout');
  }
  revalidatePath(`/features/${next}`, 'layout');
  revalidatePath('/');
}
