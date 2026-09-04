import { getGscAccessToken } from './auth';
import type {
  GscComparedRow,
  GscDimension,
  GscMetrics,
  GscPeriod,
  GscPeriodComparison,
  GscRow,
  GscSearchAnalyticsRequest,
} from './types';

const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';

function normalizeMetrics(row: {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}): GscRow {
  return {
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };
}

function emptyMetrics(): GscMetrics {
  return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

function diffMetrics(current: GscMetrics, previous: GscMetrics): GscComparedRow['delta'] {
  return {
    clicks: current.clicks - previous.clicks,
    impressions: current.impressions - previous.impressions,
    ctr: current.ctr - previous.ctr,
    position: current.position - previous.position,
  };
}

function keyFor(row: Pick<GscRow, 'keys'>): string {
  return row.keys.join('\u0000');
}

export function getGscSiteUrl(): string {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  if (!siteUrl) {
    throw new Error('GSC_SITE_URL が未設定です');
  }
  return siteUrl;
}

export async function querySearchAnalytics(
  request: GscSearchAnalyticsRequest
): Promise<GscRow[]> {
  const accessToken = await getGscAccessToken();
  const url = `${API_BASE}/${encodeURIComponent(request.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      startDate: request.period.startDate,
      endDate: request.period.endDate,
      dimensions: request.dimensions ?? [],
      rowLimit: request.rowLimit ?? 25,
      startRow: request.startRow ?? 0,
      ...(request.dimensionFilterGroups
        ? { dimensionFilterGroups: request.dimensionFilterGroups }
        : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC Search Analytics 取得に失敗しました: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };

  return (json.rows ?? []).map(normalizeMetrics);
}

export async function compareSearchAnalytics(params: {
  siteUrl: string;
  current: GscPeriod;
  previous: GscPeriod;
  dimensions?: GscDimension[];
  rowLimit?: number;
  page?: string;
  query?: string;
}): Promise<GscPeriodComparison> {
  const filters = [
    params.page
      ? { dimension: 'page' as const, operator: 'equals' as const, expression: params.page }
      : null,
    params.query
      ? { dimension: 'query' as const, operator: 'equals' as const, expression: params.query }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  const dimensionFilterGroups =
    filters.length > 0 ? [{ filters }] : undefined;

  const [currentRows, previousRows] = await Promise.all([
    querySearchAnalytics({
      siteUrl: params.siteUrl,
      period: params.current,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit,
      dimensionFilterGroups,
    }),
    querySearchAnalytics({
      siteUrl: params.siteUrl,
      period: params.previous,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit,
      dimensionFilterGroups,
    }),
  ]);

  const previousByKey = new Map(previousRows.map((row) => [keyFor(row), row]));
  const rows: GscComparedRow[] = currentRows.map((row) => {
    const previous = previousByKey.get(keyFor(row)) ?? null;
    const previousMetrics = previous ?? emptyMetrics();
    return {
      ...row,
      previous,
      delta: previous ? diffMetrics(row, previousMetrics) : diffMetrics(row, emptyMetrics()),
    };
  });

  return {
    current: params.current,
    previous: params.previous,
    rows,
  };
}
