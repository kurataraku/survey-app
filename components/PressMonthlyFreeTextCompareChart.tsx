import { MONTHLY_FREE_TEXT_COMPARE } from '@/lib/press-releases';
import PressGroupedBarChart from '@/components/PressGroupedBarChart';

/** 図4: 低満足層と高満足層をテーマごとの集合横棒で比較する。 */
export default function PressMonthlyFreeTextCompareChart() {
  const { rows, lowLabel, highLabel, lowN, highN } = MONTHLY_FREE_TEXT_COMPARE;
  const series = [
    {
      key: 'low',
      label: `${lowLabel}（${lowN}人）`,
      color: '#ff4f1f',
    },
    {
      key: 'high',
      label: `${highLabel}（${highN}人）`,
      color: '#ff9f0a',
    },
  ] as const;
  const categories = rows.map((row) => ({
    label: row.label,
    annotation: `低満足層が${row.multipleLabel}`,
    values: {
      low: row.low,
      high: row.high,
    },
  }));

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図4. 月1〜数回の低満足層では、「改善してほしい点」に進路への言及が約2.6倍、連絡・相談への言及が約2.9倍
      </figcaption>

      <PressGroupedBarChart
        ariaLabel="進路への言及は低満足層42.9％、高満足層16.3％で約2.6倍。連絡・相談への言及は28.6％、10.0％で約2.9倍"
        series={series}
        categories={categories}
        max={50}
        tickStep={10}
        labelWidth="13rem"
      />

      <table className="sr-only">
        <caption>
          月1〜数回層の改善してほしい点におけるテーマ言及率
        </caption>
        <thead>
          <tr>
            <th scope="col">テーマ</th>
            <th scope="col">
              {lowLabel}（{lowN}人）
            </th>
            <th scope="col">
              {highLabel}（{highN}人）
            </th>
            <th scope="col">倍率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.low}％</td>
              <td>{row.high}％</td>
              <td>{row.multipleLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="press-chart__note">
        対象は月1〜数回層。「改善してほしい点／合わない点」の自由記述に、当該テーマの言葉が1回でも出た人の割合です。低満足層＝総合満足度1〜3（21人）、高満足層＝4〜5（80人）。棒は0％を起点に表示。倍率は低満足層÷高満足層です。
      </p>
    </figure>
  );
}
