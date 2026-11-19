import { BASE_PATH } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { getGoogleReadOnlyAccessToken } from '@/lib/gsc/auth';

type ReportRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

export async function getPartnershipTraffic(slugs: string[], startDate: string, endDate: string) {
  const property = process.env.GA4_PARTNERSHIP_PROPERTY_ID;
  const stream = process.env.GA4_PARTNERSHIP_STREAM_ID;
  if (!property || !stream || !/^\d+$/.test(property) || !/^\d+$/.test(stream)) return { status: 'unconfigured' as const };

  try {
    const token = await getGoogleReadOnlyAccessToken('https://www.googleapis.com/auth/analytics.readonly');
    const paths = [...new Set(slugs.flatMap((slug) => [slug, encodeURIComponent(slug)]).flatMap((slug) => {
      const path = `${BASE_PATH}/schools/${slug}`;
      return [path, `${path}/`];
    }))];
    const filters = [
      { filter: { fieldName: 'streamId', stringFilter: { matchType: 'EXACT', value: stream } } },
      { filter: { fieldName: 'pagePath', inListFilter: { values: paths, caseSensitive: true } } },
    ];
    const events = [GA_EVENTS.schoolOfficialSiteClick, GA_EVENTS.schoolMaterialRequestClick];
    async function report(metric: string, byEvent: boolean): Promise<ReportRow[]> {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }], metrics: [{ name: metric }],
          ...(byEvent ? { dimensions: [{ name: 'eventName' }] } : {}),
          dimensionFilter: { andGroup: { expressions: byEvent ? [...filters, { filter: { fieldName: 'eventName', inListFilter: { values: events } } }] : filters } },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Analytics report failed: ${response.status}`);
      return (await response.json()).rows ?? [];
    }
    const [views, clicks] = await Promise.all([report('screenPageViews', false), report('eventCount', true)]);
    const eventCount = (name: string) => Number(clicks.find((row) => row.dimensionValues?.[0]?.value === name)?.metricValues?.[0]?.value ?? 0);
    return { status: 'ok' as const, views: Number(views[0]?.metricValues?.[0]?.value ?? 0),
      officialClicks: eventCount(GA_EVENTS.schoolOfficialSiteClick), requestClicks: eventCount(GA_EVENTS.schoolMaterialRequestClick) };
  } catch {
    return { status: 'unavailable' as const };
  }
}
