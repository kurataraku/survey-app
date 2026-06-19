import type { Metadata } from 'next';
import ConsultationAiPageClient from '@/components/ConsultationAiPageClient';
import { getAppBaseUrl } from '@/lib/env-check';

const PAGE_TITLE = '通信制高校えらび相談AI | 保護者向け学校選びサポート';
const PAGE_DESCRIPTION =
  '公開口コミ・学校情報・特集記事を根拠に、お子さまの状況や希望条件に合う通信制高校の選び方と候補を整理する相談AIです。';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: `${getAppBaseUrl()}/consultation-ai`,
  },
};

export default function ConsultationAiPage() {
  return <ConsultationAiPageClient />;
}
