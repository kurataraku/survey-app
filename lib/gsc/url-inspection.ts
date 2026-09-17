import { getGscAccessToken } from '@/lib/gsc/auth';

const INSPECTION_ENDPOINT =
  'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export type UrlInspectionIndexStatus = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  sitemap?: string[];
  referringUrls?: string[];
  crawledAs?: string;
};

export type UrlInspectionResult = {
  url: string;
  ok: boolean;
  error?: string;
  indexStatus?: UrlInspectionIndexStatus;
  mobileUsabilityVerdict?: string;
  richResultsVerdict?: string;
};

/**
 * URL Inspection API で1URLの登録状況を取得する。
 *
 * このAPIは1プロパティあたり1日2000件・1分50件の上限があるため、呼び出し側で対象を絞り待機を入れる。
 */
export async function inspectUrl(params: {
  siteUrl: string;
  inspectionUrl: string;
  languageCode?: string;
}): Promise<UrlInspectionResult> {
  const accessToken = await getGscAccessToken();
  const response = await fetch(INSPECTION_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: params.inspectionUrl,
      siteUrl: params.siteUrl,
      languageCode: params.languageCode ?? 'ja-JP',
    }),
  });

  if (!response.ok) {
    return {
      url: params.inspectionUrl,
      ok: false,
      error: `${response.status} ${await response.text()}`,
    };
  }

  const json = (await response.json()) as {
    inspectionResult?: {
      indexStatusResult?: UrlInspectionIndexStatus;
      mobileUsabilityResult?: { verdict?: string };
      richResultsResult?: { verdict?: string };
    };
  };

  return {
    url: params.inspectionUrl,
    ok: true,
    indexStatus: json.inspectionResult?.indexStatusResult,
    mobileUsabilityVerdict: json.inspectionResult?.mobileUsabilityResult?.verdict,
    richResultsVerdict: json.inspectionResult?.richResultsResult?.verdict,
  };
}
