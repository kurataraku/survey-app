/** 地域LPの学校カード・一覧行に出す特徴・推しポイント */
export default function SchoolHighlightList({
  highlights,
  className = 'mt-2',
}: {
  highlights: string[];
  className?: string;
}) {
  if (highlights.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="学校の特徴">
      {highlights.map((highlight) => (
        <li
          key={highlight}
          className="rounded-full bg-slate-50 px-2.5 py-1 text-xs leading-tight text-slate-700 ring-1 ring-inset ring-slate-200"
        >
          {highlight}
        </li>
      ))}
    </ul>
  );
}
