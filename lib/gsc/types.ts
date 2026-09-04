export type GscDimension = 'date' | 'page' | 'query';

export type GscPeriod = {
  startDate: string;
  endDate: string;
};

export type GscMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscRow = GscMetrics & {
  keys: string[];
};

export type GscComparedRow = GscMetrics & {
  keys: string[];
  previous: GscMetrics | null;
  delta: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
};

export type GscSearchAnalyticsRequest = {
  siteUrl: string;
  period: GscPeriod;
  dimensions?: GscDimension[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: GscDimension;
      operator: 'equals' | 'contains' | 'includingRegex' | 'excludingRegex';
      expression: string;
    }>;
  }>;
};

export type GscPeriodComparison = {
  current: GscPeriod;
  previous: GscPeriod;
  rows: GscComparedRow[];
};
