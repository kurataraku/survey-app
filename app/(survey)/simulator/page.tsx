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

interface SimulatorPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

function getStr(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

export default async function SimulatorPage({ searchParams }: SimulatorPageProps) {
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const prefecture = getStr(resolvedSearch.prefecture);
  return <LifeSimulator prefecture={prefecture || undefined} />;
}
