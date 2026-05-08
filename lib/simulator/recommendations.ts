import type { AttendanceStyle, ScoreAxis, SchoolRecommendation } from './types';

// 2通学スタイル × 3軸 = 6パターン
// DBの実評価データ（staff_rating / atmosphere_fit_rating / credit_rating）をもとに選定
// 公立高校は除外。各校の登場は最大2パターン（1回被りまで）。
//
// 軸とDBカラムの対応:
//   サポート・安心  → staff_rating が高い学校
//   自律・自由度    → credit_rating（カリキュラム柔軟性）が高い学校
//   仲間・行事      → atmosphere_fit_rating が高い学校
const data: Record<AttendanceStyle, Record<ScoreAxis, SchoolRecommendation[]>> = {
  commute: {
    // 通学×サポート重視
    // staff高順: 星槎4.83 / おおぞら4.67 / 第一学院4.60
    support: [
      {
        name: '星槎国際高等学校',
        slug: 'seisa-kokusai-kuchikomi',
        description: '先生・スタッフのサポート力が口コミの中でトップ評価。通学した生徒全員から「先生が親身に対応してくれた」という声が集まっています。',
      },
      {
        name: 'おおぞら高等学院',
        slug: 'oozora-kuchikomi',
        description: '週3〜4日通学コースがあり、スタッフによる個別サポートが手厚い。「担任がいつも気にかけてくれた」という声が多数です。',
      },
      {
        name: '第一学院高等学校',
        slug: 'daiichi-gakuin-kuchikomi',
        description: '口コミ30件以上で先生評価が高水準を維持。専任担任制で何でも相談しやすいと評判の通学型通信制です。',
      },
    ],
    // 通学×自律・自由度重視
    // credit高順: あずさ第一4.75 / 飛鳥未来4.69 / N高4.32
    // N高はユーザー希望で1位表示（通学コースも選択可）
    autonomy: [
      {
        name: 'N高等学校',
        slug: 'n-koukou-kuchikomi',
        description: '通学コースとネットコースを自分で選べるのが強み。学習スタイルを自由に決められると口コミで評価されています。',
      },
      {
        name: '飛鳥未来高等学校',
        slug: 'asukamirai-kuchikomi',
        description: '通学しながらでも自分のペースで単位を進めやすいと口コミで高評価。登校日数や学習ペースの融通が利くと評判の学校です。',
      },
      {
        name: 'あずさ第一高等学校',
        slug: 'azusa1-kuchikomi',
        description: '時間割や学習の進め方を自分で決めやすいと口コミで評価が高く、通学コースでも無理なく自分のペースで学べる環境が整っています。',
      },
    ],
    // 通学×仲間・行事重視
    // atmo高順: 星槎4.33（overlap OK） / クラーク3.92 / ヒューマンキャンパス3.67
    community: [
      {
        name: '星槎国際高等学校',
        slug: 'seisa-kokusai-kuchikomi',
        description: '通う生徒同士の雰囲気・居心地の良さが口コミでトップ評価。スクーリングを通じて自然に友達ができると評判の学校です。',
      },
      {
        name: 'クラーク記念国際高等学校',
        slug: 'clark-kuchikomi',
        description: '全国にキャンパスがある大手通信制で、部活・行事が充実。通学コースでは同じ趣味の仲間と出会えると口コミで評判です。',
      },
      {
        name: 'ヒューマンキャンパス高等学校',
        slug: 'human-campus-kuchikomi',
        description: '多彩な専門コースが揃い、通学しながら同じ興味を持つ仲間と交流しやすい環境。キャンパスでの交流機会が充実しています。',
      },
    ],
  },
  online: {
    // オンライン×サポート重視
    // 第一学院は通学/online両コースあり（overlap OK）/ S高・トライ式はオンライン系
    support: [
      {
        name: '第一学院高等学校',
        slug: 'daiichi-gakuin-kuchikomi',
        description: '通学・在宅どちらのコースでも先生への相談体制が整っており、在宅でも担任との距離が近いと口コミで評判です。',
      },
      {
        name: 'S高等学校',
        slug: 's-koutougakkou-kuchikomi',
        description: 'N高と同じドワンゴ・KADOKAWAグループ。在宅中心でも担任・チューターによる定期フォローが充実しています。',
      },
      {
        name: 'トライ式高等学院',
        slug: 'try-gakuin-kuchikomi',
        description: '個別指導のトライが運営。先生評価が高く、在宅学習でも手厚い個別サポートを受けられる環境が整っています。',
      },
    ],
    // オンライン×自律・自由度重視
    // N高はcommute/autonomyとのoverlap OK / NHK学園credit4.50最高 / ルネサンス4.38
    autonomy: [
      {
        name: 'N高等学校',
        slug: 'n-koukou-kuchikomi',
        description: 'ネットコースなら全国どこからでも学習可能。充実したオンライン教材で、自分のペースを最大限に活かした学習が実現できます。',
      },
      {
        name: 'NHK学園高等学校',
        slug: 'nhk-gakuen-kuchikomi',
        description: '長い歴史を持つ老舗の通信制高校。年数日のスクーリングのみで、レポートの提出ペースを自分で管理できる自由度が口コミでも高く評価されています。',
      },
      {
        name: 'ルネサンス高等学校',
        slug: 'renaissance-kuchikomi',
        description: '完全在宅での学習が可能で、柔軟性の高さが口コミで評価されています。自分のペースを崩さず学びたい方に向いています。',
      },
    ],
    // オンライン×仲間・行事重視
    // 鹿島学園はonline dominant（8/11）・全国ネットワーク / S高はvirtual campus（overlap OK）/ ルネサンス大阪atmo4.00
    community: [
      {
        name: '鹿島学園高等学校',
        slug: 'kashima-gakuen-kuchikomi',
        description: '全国700校以上のサポート校ネットワークがあり、月数回の登校で気軽に仲間と会える環境が整っています。',
      },
      {
        name: 'S高等学校',
        slug: 's-koutougakkou-kuchikomi',
        description: 'バーチャル空間のキャンパスやオンライン部活が充実。在宅中心でも仲間とつながれる仕組みがN高グループならではです。',
      },
      {
        name: '勇志国際高等学校',
        slug: 'yushi-kokusai-kuchikomi',
        description: '全国どこからでも入学できるオンライン特化型の学校。スクーリング時に全国の仲間と交流できる機会が口コミで好評です。',
      },
    ],
  },
};

export function getRecommendations(
  style: AttendanceStyle,
  axis: ScoreAxis
): SchoolRecommendation[] {
  return data[style][axis];
}
