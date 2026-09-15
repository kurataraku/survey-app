import { ATTENDANCE_METRIC_COMPARE } from '@/lib/press-releases';
import PressGroupedBarChart from '@/components/PressGroupedBarChart';

/** 図2: 3指標を通学頻度ごとに集合横棒で比較する。 */
export default function PressMonthlyMetricCompareChart() {
  const { frequencies, series, monthlyLearning } = ATTENDANCE_METRIC_COMPARE;
  const valleyIndex = 1;
  const chartSeries = [
    {
      key: 'support',
      label: '心身サポート',
      color: '#ff4f1f',
    },
    {
      key: 'atmosphere',
      label: '雰囲気の適合',
      color: '#ff9f0a',
    },
    {
      key: 'career',
      label: '進路サポート',
      color: '#168bd2',
    },
  ] as const;
  const categories = frequencies.map((frequency, index) => ({
    label: frequency,
    annotation: index === valleyIndex ? '3項目とも最低' : undefined,
    values: Object.fromEntries(
      series.map((metric) => [metric.key, metric.values[index]])
    ),
  }));

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図2. 通学頻度別の個別評価・高評価率（各項目4〜5／心身サポート／雰囲気／進路）
      </figcaption>

      <PressGroupedBarChart
        ariaLabel="心身サポート、雰囲気の適合、進路サポートはいずれも月1〜数回層が5区分中で最低"
        series={chartSeries}
        categories={categories}
        labelWidth="11rem"
      />

      <p className="mt-3 text-sm leading-7 text-slate-700">
        月1〜数回層では、単位取得のしやすさは
        <strong>{monthlyLearning[0].value}％</strong>、学びの柔軟さは
        <strong>{monthlyLearning[1].value}％</strong>と、学習面の高評価は8割を超えています。
      </p>

      <table className="sr-only">
        <caption>通学頻度別の個別評価・高評価率</caption>
        <thead>
          <tr>
            <th scope="col">通学頻度</th>
            {series.map((metric) => (
              <th key={metric.key} scope="col">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frequencies.map((frequency, index) => (
            <tr key={frequency}>
              <th scope="row">{frequency}</th>
              {series.map((metric) => (
                <td key={metric.key}>{metric.values[index]}％</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="press-chart__note">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。棒は0％を起点に表示。ここでの高評価率は個別項目（4〜5）であり、総合満足度の高満足率とは別指標です。
      </p>
    </figure>
  );
}
