import { ONLINE_VS_WEEKLY_COMPARE } from '@/lib/press-releases';
import PressGroupedBarChart from '@/components/PressGroupedBarChart';

/** 図3: 2群を項目ごとの集合横棒で比較する。 */
export default function PressOnlineVsWeeklyChart() {
  const { groups, rows } = ONLINE_VS_WEEKLY_COMPARE;
  const series = [
    {
      key: 'online',
      label: groups[0].short,
      color: '#168bd2',
    },
    {
      key: 'weekly',
      label: groups[1].short,
      color: '#ff8a00',
    },
  ] as const;
  const categories = rows.map((row) => ({
    label: row.label,
    annotation:
      row.key === 'overall'
        ? '同率'
        : row.key === 'tuition'
          ? '※低いほど低評価者が少ない'
          : undefined,
    values: {
      online: row.online,
      weekly: row.weekly,
    },
  }));

  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図3. ほぼオンライン層と週5通学層の比較（単位：％）
      </figcaption>

      <PressGroupedBarChart
        ariaLabel="高満足率は両群94.3％で同率。心身サポート高評価はほぼオンライン60.3％、週5通学87.4％。進路サポート高評価は62.0％、81.6％。学費の低評価は7.9％、20.0％"
        series={series}
        categories={categories}
        labelWidth="12rem"
      />

      <table className="sr-only">
        <caption>ほぼオンライン層と週5通学層の比較</caption>
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">{groups[0].label}</th>
            <th scope="col">{groups[1].label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>
                {row.online}％（{row.onlineCount}）
              </td>
              <td>
                {row.weekly}％（{row.weeklyCount}）
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="press-chart__note">
        出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計。棒は0％を起点に表示。高満足層＝総合満足度4〜5。個別項目の高評価＝各項目4〜5。学費の低評価のみ1〜2の割合です。
      </p>
    </figure>
  );
}
