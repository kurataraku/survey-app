/** 都道府県LP上部に表示する「保護者が確認したい比較ポイント」 */

export type ParentGuidePoint = {
  title: string;
  description: string;
};

export function getPrefectureParentGuidePoints(prefecture: string): ParentGuidePoint[] {
  return [
    {
      title: '通学頻度と通い方',
      description: `${prefecture}の学校は、週1〜2回の通学からオンライン中心まで選択肢が異なります。口コミの通学頻度と、公式のスクーリング日程をあわせて確認してください。`,
    },
    {
      title: '学費の見方',
      description:
        '入学金・授業料のほか、教材費やスクーリング費が別途かかる場合があります。口コミの学費満足度と、公式の費用内訳をセットで見比べると判断しやすくなります。',
    },
    {
      title: '公立・私立・サポート校の違い',
      description: `${prefecture}では区分ごとに通い方やサポートの厚さが異なります。サポート校は提携校の学習支援が中心になるため、卒業資格の仕組みも公式情報で確認してください。`,
    },
    {
      title: '不登校経験がある場合',
      description:
        '心身の不調や人間関係など、背景は学校ごとに異なります。口コミの「合う人・合わない人」と、先生・職員のサポート評価を参考に、無理のない通い方を選んでください。',
    },
    {
      title: '見学・説明会で確認すること',
      description:
        '通学頻度、単位取得の進め方、転入・編入の可否、保護者への連絡体制などは、パンフレットだけでは判断しにくい点です。見学時に具体的な質問を用意しておくと安心です。',
    },
  ];
}
