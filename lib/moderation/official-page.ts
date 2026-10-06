import type { OfficialPageResult } from './types';

const EXCERPT_LENGTH = 4000;

export function isSafeOfficialUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return null;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null;
  return url;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchOfficialPageExcerpt(url: string | null | undefined): Promise<OfficialPageResult> {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return {
      status: 'missing',
      text: '',
      note: '公式URLが未登録のため、公式ページは読んでいない',
    };
  }

  const safe = isSafeOfficialUrl(trimmed);
  if (!safe) {
    return {
      status: 'failed',
      text: '',
      note: '公式URLが安全に取得できるhttpsのURLではないため、公式ページは読んでいない',
    };
  }

  try {
    const response = await fetch(safe.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'TsushinKuchikomiModeration/1.0',
        Accept: 'text/html,text/plain;q=0.9',
      },
    });
    if (!response.ok) {
      return {
        status: 'failed',
        text: '',
        note: `公式ページの取得に失敗した（HTTP ${response.status}）`,
      };
    }

    const type = response.headers.get('content-type') ?? '';
    if (type.includes('pdf')) {
      return { status: 'failed', text: '', note: '公式URLがPDFのため、本文は読んでいない' };
    }
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return { status: 'failed', text: '', note: '公式URLの形式がHTMLではないため、本文は読んでいない' };
    }

    const text = htmlToText(await response.text()).slice(0, EXCERPT_LENGTH);
    if (text.length < 40) {
      return { status: 'failed', text: '', note: '公式ページから本文をほとんど取れなかった' };
    }
    return { status: 'fetched', text, note: '' };
  } catch (error) {
    console.error('[moderate] 公式ページの取得に失敗:', error);
    return { status: 'failed', text: '', note: '公式ページの取得に失敗した' };
  }
}
