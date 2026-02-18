import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

/**
 * HeadersOverflowError (UND_ERR_HEADERS_OVERFLOW) を回避するため、
 * maxHeaderSize を拡張した fetch を使う Supabase クライアント。
 * 大量データ取得時に Supabase のレスポンスヘッダーが Node.js のデフォルト制限を超える場合に使用。
 */
export function createSupabaseClientWithLargeHeaders(
  url: string,
  serviceRoleKey: string
): SupabaseClient {
  const agent = new Agent({ maxHeaderSize: 65536 }); // 64KB（デフォルト16KB）

  const customFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return undiciFetch(input as URL, { ...init, dispatcher: agent } as any) as unknown as Promise<Response>;
  };

  return createClient(url, serviceRoleKey, {
    global: { fetch: customFetch },
  });
}
