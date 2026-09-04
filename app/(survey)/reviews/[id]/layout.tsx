import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { getReviewById } from '@/lib/reviews/getReviewById';

const DESCRIPTION_MAX = 160;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const appBaseUrl = getAppBaseUrl();
  const pathname = `/reviews/${resolved.id}`;
  const canonical = `${appBaseUrl}${pathname}`;

  const review = await getReviewById(resolved.id);

  if (!review) {
    return {
      title: '口コミが見つかりません',
      alternates: { canonical },
    };
  }

  const title = `${review.school_name}の口コミ（投稿）`;
  const fullTitle = `${title} | 通信制高校リアルレビュー`;
  const rawDesc = [review.good_comment, review.bad_comment]
    .filter(Boolean)
    .join(' ')
    .slice(0, 200);
  const description = rawDesc
    ? truncate(rawDesc, DESCRIPTION_MAX)
    : `${review.school_name}の口コミ・レビュー詳細。実際に通った人のリアルな体験談。`;

  return {
    title,
    description,
    keywords: [
      `${review.school_name} 口コミ`,
      '通信制高校 口コミ',
      '通信制 口コミ',
      '通信制高校 体験談',
    ],
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      type: 'website',
      url: canonical,
    },
  };
}

export default function ReviewDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
