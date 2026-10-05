/** PostgREST が1リクエストで返す行数の上限（このプロジェクトの Supabase 設定は1000行） */
export const SUPABASE_MAX_ROWS = 1000;

/**
 * 上限を超える件数を range で分けて全件取得する。
 * ページ間で行が重複・欠落しないよう、fetchPage のクエリは一意な列で order すること。
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_MAX_ROWS) {
    const { data, error } = await fetchPage(from, from + SUPABASE_MAX_ROWS - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < SUPABASE_MAX_ROWS) return rows;
  }
}
