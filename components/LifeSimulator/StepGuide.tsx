'use client';

import Link from 'next/link';
import type { AttendanceStyle, SimScore } from '@/lib/simulator/types';
import { getTopAxis } from '@/lib/simulator/scoring';
import {
  getPrefectureLandingLink,
  getReviewsLink,
  getSchoolsLink,
  getRankingLink,
} from '@/lib/simulator/guide-links';
import { appPath } from '@/lib/base-path';

interface Props {
  scores: SimScore;
  attendanceStyle: AttendanceStyle;
  prefecture?: string;
  onRestart: () => void;
}

const AXIS_LABEL: Record<string, string> = {
  support:   'サポート・安心',
  autonomy:  '自律・自由度',
  community: '仲間・行事',
};

export default function StepGuide({ scores, attendanceStyle, prefecture, onRestart }: Props) {
  const topAxis = getTopAxis(scores);
  const hasPrefecture = Boolean(prefecture);

  const links = [
    {
      href: getReviewsLink(attendanceStyle, prefecture),
      emoji: '💬',
      title: attendanceStyle === 'commute'
        ? `${hasPrefecture ? `${prefecture}で` : ''}通学スタイルの口コミを読む`
        : `${hasPrefecture ? `${prefecture}で` : ''}オンライン中心の口コミを読む`,
      desc: hasPrefecture
        ? `${prefecture}の学校に絞って、近い通い方の口コミを確認できます`
        : '同じ通い方をした在校生・卒業生のリアルな口コミ一覧',
      gradient: 'from-sky-400 to-blue-500',
      bg: 'bg-sky-50 border-sky-100 hover:border-sky-400',
      textColor: 'text-sky-700',
    },
    {
      href: getSchoolsLink(prefecture),
      emoji: '🏫',
      title: hasPrefecture ? `${prefecture}の学校一覧に戻る` : '全国の通信制高校一覧から探す',
      desc: hasPrefecture
        ? '診断で整理した条件をもとに、同じ地域の学校を比較できます'
        : 'エリア・特色・通学スタイルで条件を絞って比較できます',
      gradient: 'from-violet-400 to-indigo-500',
      bg: 'bg-violet-50 border-violet-100 hover:border-violet-400',
      textColor: 'text-violet-700',
    },
    {
      href: hasPrefecture
        ? getPrefectureLandingLink(prefecture!, topAxis === 'support' ? 'pref-highlights-rating' : 'pref-highlights-tuition')
        : getRankingLink(topAxis),
      emoji: '🏆',
      title: hasPrefecture
        ? `${prefecture}の評価が高い学校を見比べる`
        : `「${AXIS_LABEL[topAxis]}」を重視する学校ランキング`,
      desc: hasPrefecture
        ? '地域ページ内の満足度ピックアップに戻って比較できます'
        : 'お子さんが一番大切にしたいポイントで学校を順位比較',
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-50 border-emerald-100 hover:border-emerald-400',
      textColor: 'text-emerald-700',
    },
  ];

  return (
    <div className="pb-8">
      {/* ヘッダー */}
      <div className="mb-5">
        <h2 className="text-[24px] font-black text-gray-900 leading-snug mb-1">
          お子さんに合う学校を<br />さらに探しましょう
        </h2>
        <p className="text-sm text-gray-500 font-medium">口コミ・ランキングで実際の評判を確認できます</p>
      </div>

      {/* 次のアクション */}
      <p className="text-sm font-black text-gray-500 mb-3">次にできること</p>
      <div className="flex flex-col gap-3 mb-8">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`group border-2 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] ${link.bg}`}
          >
            <div className="flex items-center gap-3">
              <div className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${link.gradient} flex items-center justify-center text-3xl shadow-sm`}>
                {link.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-[15px] mb-0.5 ${link.textColor}`}>{link.title}</p>
                <p className="text-sm text-gray-500 leading-snug">{link.desc}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* やり直し */}
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-3 font-medium">別の通学スタイルでも試してみる？</p>
        <button
          onClick={onRestart}
          className="border-2 border-gray-200 text-gray-600 font-black text-base px-8 py-3 rounded-2xl hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all duration-200"
        >
          もう一度診断する
        </button>
      </div>
    </div>
  );
}
