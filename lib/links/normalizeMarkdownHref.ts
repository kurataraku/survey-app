import { BASE_PATH, appPath } from '@/lib/base-path';

/** メディア内の相対パス（アプリルート基準） */
const INTERNAL_ROOT_PREFIXES = [
  '/schools',
  '/reviews',
  '/rankings',
  '/features',
  '/about',
  '/contact',
  '/survey',
  '/terms',
  '/privacy',
  '/export',
] as const;

function isInternalRootPath(pathname: string): boolean {
  return INTERNAL_ROOT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`)
  );
}

/**
 * Markdown のリンク href を判定し、サイト内なら Link 用の href（ベースパス付き）に正規化する。
 */
export function normalizeMarkdownHref(href: string | undefined): {
  internal: boolean;
  href: string;
} {
  if (!href) return { internal: false, href: '' };
  const trimmed = href.trim();
  if (
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('#')
  ) {
    return { internal: false, href: trimmed };
  }

  if (trimmed.startsWith(BASE_PATH)) {
    return { internal: true, href: trimmed };
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return { internal: false, href: trimmed };
    if (isInternalRootPath(trimmed)) {
      return { internal: true, href: appPath(trimmed) };
    }
    return { internal: false, href: trimmed };
  }

  try {
    const u = new URL(trimmed);
    const path = u.pathname + (u.search || '');
    if (path.startsWith(BASE_PATH)) {
      return { internal: true, href: path };
    }
    if (isInternalRootPath(u.pathname)) {
      return { internal: true, href: appPath(u.pathname + (u.search || '')) };
    }
  } catch {
    /* 相対URL以外 */
  }

  return { internal: false, href: trimmed };
}
