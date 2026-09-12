import { BASE_PATH } from '@/lib/base-path';
import type { HtmlFactSnapshot, SeoPageType } from './types';

const MAX_HTML_LENGTH = 1_000_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (match, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .trim();
}

function textContent(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1]!.toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function metaContent(html: string, name: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if ((attrs.name ?? attrs.property)?.toLowerCase() === name.toLowerCase()) {
      return attrs.content?.trim() || null;
    }
  }
  return null;
}

function canonicalHref(html: string, pageUrl: URL): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if (attrs.rel?.toLowerCase().split(/\s+/).includes('canonical') && attrs.href) {
      try {
        return new URL(attrs.href, pageUrl).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

function collectInternalLinks(html: string, pageUrl: URL): string[] {
  const links = new Set<string>();
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attributes(tag).href;
    if (!href) continue;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.origin !== pageUrl.origin || !['http:', 'https:'].includes(resolved.protocol)) {
        continue;
      }
      resolved.hash = '';
      links.add(resolved.toString());
    } catch {
      // 不正なhrefはFactとして採用しない
    }
  }
  return [...links].sort();
}

export function identifyPageUrl(targetUrl: string, siteUrl: string): {
  pageType: SeoPageType;
  slug: string | null;
  url: string;
} {
  const target = new URL(targetUrl);
  const site = new URL(siteUrl);
  if (!['http:', 'https:'].includes(target.protocol) || target.origin !== site.origin) {
    throw new Error('対象URLはNEXT_PUBLIC_SITE_URLと同一originである必要があります');
  }
  if (target.username || target.password) {
    throw new Error('認証情報を含む対象URLは使用できません');
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(target.pathname);
  } catch {
    throw new Error('対象URLのパスをデコードできません');
  }
  const appPath = pathname === BASE_PATH ? '/' : pathname.startsWith(`${BASE_PATH}/`)
    ? pathname.slice(BASE_PATH.length)
    : pathname;
  const school = appPath.match(/^\/schools\/([^/]+)\/?$/);
  const feature = appPath.match(/^\/features\/([^/]+)\/?$/);

  return {
    pageType: school ? 'school' : feature ? 'feature' : 'other',
    slug: school?.[1] ?? feature?.[1] ?? null,
    url: target.toString(),
  };
}

export function parseHtmlFacts(html: string, pageUrl: string, status = 200): HtmlFactSnapshot {
  const url = new URL(pageUrl);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

  return {
    status,
    title: titleMatch ? textContent(titleMatch[1]!) || null : null,
    description: metaContent(html, 'description'),
    canonical: canonicalHref(html, url),
    robots: metaContent(html, 'robots'),
    h1: h1Match ? textContent(h1Match[1]!) || null : null,
    internalLinks: collectInternalLinks(html, url),
  };
}

export async function fetchHtmlFacts(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<HtmlFactSnapshot> {
  const response = await fetchImpl(targetUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: {
      accept: 'text/html',
      'user-agent': 'SurveyAppSeoLoop/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`公開HTML取得に失敗しました: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) {
    throw new Error(`公開URLがHTMLを返しませんでした: ${contentType || 'unknown'}`);
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_LENGTH) {
    throw new Error('公開HTMLが収集上限を超えています');
  }
  if (!response.body) {
    throw new Error('公開HTMLのレスポンス本文がありません');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_HTML_LENGTH) {
      await reader.cancel();
      throw new Error('公開HTMLが収集上限を超えています');
    }
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();
  return parseHtmlFacts(html, targetUrl, response.status);
}
