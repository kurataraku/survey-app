import { ATTENDANCE_SATISFACTION_DATA } from '@/lib/press-releases';

/** 図1: 0%起点の縦棒で、通学頻度別の高満足率を誇張せず比較する。 */
export default function PressSatisfactionValleyChart() {
  return (
    <figure className="mt-6">
      <figcaption className="press-chart__title">
        図1. 主な通学頻度別・高満足率（高満足層の割合／単位：％／有効回答849件）
      </figcaption>

      <div className="press-chart">
        <div
          className="relative h-[19rem] border-b border-l border-slate-400 pl-2 sm:h-[21rem] sm:pl-4"
          role="img"
          aria-label="ほぼオンライン94.3％、月1〜数回79.2％、週1〜2は92.1％、週3〜4は90.1％、週5は94.3％。月1〜数回が最も低い"
        >
          {[25, 50, 75, 100].map((tick) => (
            <div
              key={tick}
              className="pointer-events-none absolute inset-x-0 border-t border-slate-200"
              style={{ bottom: `${tick}%` }}
            >
              <span className="absolute -left-8 -top-2.5 w-6 text-right text-[11px] text-slate-500">
                {tick}
              </span>
            </div>
          ))}

          <div className="absolute inset-0 grid grid-cols-5 items-end gap-2 px-2 sm:gap-5 sm:px-5">
            {ATTENDANCE_SATISFACTION_DATA.map((item) => {
              const highlighted = 'highlighted' in item && item.highlighted;
              return (
                <div
                  key={item.label}
                  className="relative h-full min-w-0 text-center"
                >
                  <div
                    className="absolute inset-x-0 text-xs font-bold text-slate-800 sm:text-sm"
                    style={{ bottom: `calc(${item.value}% + 0.3rem)` }}
                  >
                    {item.value}
                    <span className="text-[10px] sm:text-xs">％</span>
                  </div>
                  <div
                    className="absolute bottom-0 left-1/2 w-full max-w-14 -translate-x-1/2 border-t-2 sm:max-w-16"
                    style={{
                      height: `${item.value}%`,
                      backgroundColor: highlighted
                        ? 'var(--press-orange)'
                        : 'var(--press-navy)',
                      borderColor: highlighted
                        ? 'var(--press-orange)'
                        : 'var(--press-navy)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="ml-2 grid grid-cols-5 gap-2 px-2 pt-2 sm:ml-4 sm:gap-5 sm:px-5">
          {ATTENDANCE_SATISFACTION_DATA.map((item) => {
            const highlighted = 'highlighted' in item && item.highlighted;
            const labels = shortLabel(item.label);
            return (
              <div
                key={item.label}
                className="min-w-0 text-center text-[11px] font-medium leading-4 text-slate-700 sm:text-xs"
              >
                <span className="block">{labels[0]}</span>
                {labels[1] ? <span className="block">{labels[1]}</span> : null}
                {highlighted ? (
                  <span className="mt-1 block font-bold text-[var(--press-orange)]">
                    最低
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-right text-[11px] text-slate-500">
          棒は0％を起点に表示
        </p>
      </div>

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

function shortLabel(label: string): [string, string?] {
  switch (label) {
    case 'ほぼオンライン／自宅':
      return ['ほぼ', 'オンライン'];
    case '月1〜数回':
      return ['月1〜', '数回'];
    case '週1〜2':
      return ['週1〜2'];
    case '週3〜4':
      return ['週3〜4'];
    case '週5':
      return ['週5'];
    default:
      return [label];
  }
}
