import { revalidatePath } from 'next/cache';
import { isSafeNoticeLink } from '@/lib/notices/getPublishedNotices';

export interface NoticeInput {
  title?: string;
  body?: string | null;
  link_url?: string | null;
  is_published?: boolean;
  published_at?: string;
}

/**
 * 管理画面からの入力を検証・整形する。
 * partial=true（PATCH）では、送られた項目だけを返す。
 */
export function parseNoticeInput(
  raw: NoticeInput,
  partial: boolean
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const value: Record<string, unknown> = {};

  if (raw.title !== undefined || !partial) {
    const title = (raw.title ?? '').trim();
    if (!title) return { ok: false, error: 'タイトルを入力してください' };
    value.title = title;
  }
  if (raw.body !== undefined) {
    value.body = raw.body?.trim() ? raw.body.trim() : null;
  }
  if (raw.link_url !== undefined) {
    const link = raw.link_url?.trim() ?? '';
    if (link && !isSafeNoticeLink(link)) {
      return { ok: false, error: 'リンク先は https:// で始まるURL、または / で始まるパスで入力してください' };
    }
    value.link_url = link || null;
  }
  if (raw.is_published !== undefined) value.is_published = Boolean(raw.is_published);
  if (raw.published_at !== undefined) {
    const d = new Date(raw.published_at);
    if (Number.isNaN(d.getTime())) return { ok: false, error: '表示日が正しくありません' };
    value.published_at = d.toISOString();
  }
  return { ok: true, value };
}

/** 書き込み後に、トップと一覧ページの ISR キャッシュを即時更新する */
export function revalidateNoticePages() {
  revalidatePath('/');
  revalidatePath('/notices');
}
