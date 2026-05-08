import type { SimScore, ScoreAxis, ResultType } from './types';

export const SCORE_MAX: Record<ScoreAxis, number> = {
  support: 10,
  autonomy: 10,
  community: 8,
};

export function calcScore(choices: ('A' | 'B')[], axisMap: { A: ScoreAxis; B: ScoreAxis }[]): SimScore {
  const raw: SimScore = { support: 0, autonomy: 0, community: 0 };
  choices.forEach((choice, i) => {
    const axis = axisMap[i][choice];
    raw[axis] += 2;
  });
  return raw;
}

export function normalizeScore(raw: SimScore): SimScore {
  return {
    support: Math.round((raw.support / SCORE_MAX.support) * 10),
    autonomy: Math.round((raw.autonomy / SCORE_MAX.autonomy) * 10),
    community: Math.round((raw.community / SCORE_MAX.community) * 10),
  };
}

export function getTopAxis(scores: SimScore): ScoreAxis {
  const entries = Object.entries(scores) as [ScoreAxis, number][];
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export const resultTypes: Record<ScoreAxis, ResultType> = {
  support: {
    axis: 'support',
    title: '先生・サポートを大切にするタイプ',
    description: '困ったときに相談できる先生やスタッフの存在が、お子さんにとって安心して学ぶ上でとても大切なようです。担任制やカウンセラーが充実した、手厚いフォローがある学校環境が合いそうです。',
    schoolFeature: '少人数担任制・カウンセラー常駐・定期個人面談がある学校',
  },
  autonomy: {
    axis: 'autonomy',
    title: '自分のペースを大切にするタイプ',
    description: '誰かに管理されるより、自分でスケジュールを決めて進めるスタイルがお子さんに合っているようです。自由度が高くレポート提出の柔軟性が高い学校環境で力を発揮できます。',
    schoolFeature: 'レポート提出が柔軟・登校日数を自分で調整できる学校',
  },
  community: {
    axis: 'community',
    title: '仲間とのつながりを大切にするタイプ',
    description: '友達や仲間との関わりが学校生活のモチベーションになるタイプのようです。スクーリングが充実していたり、交流イベントがある学校環境がお子さんの力を引き出します。',
    schoolFeature: 'スクーリング日数が多い・部活や文化祭がある学校',
  },
};

// 7日間の軸マッピング（シナリオファイルのA/B順と対応）
export const axisMap: { A: ScoreAxis; B: ScoreAxis }[] = [
  { A: 'support',   B: 'autonomy'   }, // 月: 学習課題
  { A: 'community', B: 'support'    }, // 火: スクーリング
  { A: 'autonomy',  B: 'community'  }, // 水: 分からないこと
  { A: 'community', B: 'support'    }, // 木: 放課後
  { A: 'community', B: 'autonomy'   }, // 金: 体調
  { A: 'autonomy',  B: 'support'    }, // 土: 進路
  { A: 'support',   B: 'autonomy'   }, // 日: 翌週準備
];
