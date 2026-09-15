import { ATTENDANCE_SATISFACTION_DATA } from '@/lib/press-releases';
import PressGroupedBarChart from '@/components/PressGroupedBarChart';

/** 図1: 通学頻度別の高満足率を横棒で比較する。 */
export default function PressSatisfactionValleyChart() {
  const series = [
    {
      key: 'satisfaction',
      label: '高満足率',
      color: 'var(--press-blue)',
    },
  ] as const;
  const categories = ATTENDANCE_SATISFACTION_DATA.map((item) => {
    const highlighted = 'highlighted' in item && item.highlighted;
    return {
      label: item.label,
      values: { satisfaction: item.value },
      annotation: highlighted ? '5区分中で最低' : undefined,
      colors: highlighted
        ? { satisfaction: 'var(--press-orange)' }
        : undefined,
    };
  });

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図1. 主な通学頻度別・高満足率（高満足層の割合／単位：％／有効回答849件）
      </figcaption>

      <PressGroupedBarChart
        ariaLabel="ほぼオンライン94.3％、月1〜数回79.2％、週1〜2は92.1％、週3〜4は90.1％、週5は94.3％。月1〜数回が最も低い"
        series={series}
        categories={categories}
        labelWidth="11rem"
        showLegend={false}
      />

      <table className="sr-only">
        <caption>通学頻度別の高満足率と人数</caption>
        <thead>
          <tr>
            <th scope="col">主な通学頻度</th>
            <th scope="col">高満足率</th>
            <th scope="col">人数</th>
          </tr>
        </thead>
        <tbody>
          {ATTENDANCE_SATISFACTION_DATA.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.value}％</td>
              <td>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="press-chart__note">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。高満足率＝総合満足度4〜5（高満足層）の割合。
      </p>
    </figure>
  );
}
