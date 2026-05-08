import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import LifeSimulator from '@/components/LifeSimulator';

export const metadata: Metadata = {
  title: '通信制高校えらび診断ナビ | 通信制高校リアルレビュー',
  description: 'A/Bを選んで進めるだけ。7つの場面をゲーム感覚でクリアするうちに、お子さんに合う通信制高校のタイプへナビゲートします。無料・登録不要。',
  alternates: { canonical: `${getAppBaseUrl()}/simulator` },
  openGraph: {
    title: '通信制高校えらび診断ナビ',
    description: 'A/Bを選んで進めるだけ。ゲーム感覚で、お子さんに合う通信制高校のタイプが見つかります。',
    type: 'website',
  },
};

export default function SimulatorPage() {
  return <LifeSimulator />;
}
