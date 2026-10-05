import { describe, expect, it } from 'vitest';
import { fetchAllRows, SUPABASE_MAX_ROWS } from '@/lib/supabase/fetchAllRows';

function fakeTable(total: number) {
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: total }, (_, i) => i);
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + SUPABASE_MAX_ROWS)), error: null };
  };
  return { calls, fetchPage };
}

describe('fetchAllRows', () => {
  it('上限を超える件数をページに分けて全件取得する', async () => {
    const { calls, fetchPage } = fakeTable(2345);
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(2345);
    expect(rows[2344]).toBe(2344);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('ちょうど上限の件数なら、空ページを確認して終える', async () => {
    const { calls, fetchPage } = fakeTable(1000);
    expect(await fetchAllRows(fetchPage)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it('エラーは握りつぶさずに投げる', async () => {
    const error = new Error('boom');
    await expect(fetchAllRows(async () => ({ data: null, error }))).rejects.toBe(error);
  });
});
