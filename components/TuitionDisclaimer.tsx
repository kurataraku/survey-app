interface TuitionDisclaimerProps {
  className?: string;
  /** lead: セクション見出し直下の短い注意喚起 / full: 金額ブロック下の詳細注記 */
  variant?: 'lead' | 'full';
}

/**
 * 学費に関する共通注意文。
 * 都道府県ページ・学校詳細ページの学費セクション付近に表示する。
 * Server / Client どちらからも利用できるプレーンな表示コンポーネント。
 */
export default function TuitionDisclaimer({ className = '', variant = 'full' }: TuitionDisclaimerProps) {
  if (variant === 'lead') {
    return (
      <p
        className={`text-sm text-amber-900 leading-relaxed rounded-lg border border-amber-200 bg-amber-50/90 px-3.5 py-3 ${className}`}
        role="note"
      >
        掲載している金額は、各学校の公開情報にもとづく<strong className="font-semibold">初年度納入金の参考目安</strong>
        （就学支援金適用前）です。就学支援金の適用、コース・通学頻度、世帯状況などにより実際の負担額は異なります。
        <strong className="font-semibold">最新の正確な金額は、必ず学校の公式資料・説明会・個別相談でご確認ください。</strong>
      </p>
    );
  }

  return (
    <p className={`text-xs text-gray-500 leading-relaxed ${className}`}>
      ※通信制高校の学費は、学校種別、通学頻度、選択コース、サポート内容、就学支援金の適用状況によって大きく変わります。このページでは、確認できる公開情報をもとに、初年度納入金（入学後1年目の学校納付額・就学支援金適用前）の目安を掲載しています。2年目以降の費用や教材費・制服等は含まれない場合があります。実際の負担額は家庭の状況や選択コースによって異なるため、最新情報は必ず各学校の公式資料・説明会・個別相談でご確認ください。
    </p>
  );
}
