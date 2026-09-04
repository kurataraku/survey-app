import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

const appBaseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: '通信制高校リアルレビューへのお問い合わせはこちらから。',
  alternates: { canonical: `${appBaseUrl}/contact` },
  openGraph: {
    title: 'お問い合わせ | 通信制高校リアルレビュー',
    description: '通信制高校リアルレビューへのお問い合わせはこちらから。',
    type: 'website',
    url: `${appBaseUrl}/contact`,
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
