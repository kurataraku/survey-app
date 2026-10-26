import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import MyStoryAwardForm from '@/components/MyStoryAwardForm';

const appBaseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: '応募フォーム｜通信制高校 MY STORY AWARD',
  description: '通信制高校 MY STORY AWARD の応募フォーム。下書き保存に対応しています。',
  alternates: { canonical: `${appBaseUrl}/my-story-award/apply` },
  robots: { index: false, follow: false },
};

export default function MyStoryAwardApplyPage() {
  return <MyStoryAwardForm />;
}
