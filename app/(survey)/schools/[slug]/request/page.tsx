import type { Metadata } from 'next';
import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getRequestTarget } from '@/lib/partnerships/server';
import SchoolMaterialRequestForm from '@/components/SchoolMaterialRequestForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '無料の資料請求', robots: { index: false, follow: false } };

export default async function RequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getRequestTarget(slug);
  return (
    <div className="mx-auto my-8 max-w-xl rounded-2xl bg-white p-5 shadow-sm sm:p-8">
      <Link href={appPath(`/schools/${encodeURIComponent(slug)}`)} className="text-sm text-blue-700 underline">学校ページに戻る</Link>
      <h1 className="mb-3 mt-4 text-2xl font-bold">無料の資料請求</h1>
      {school ? <>
        <p className="mb-6 text-slate-700"><strong>{school.name}</strong>の資料を学校から郵送します。保護者の方、または18歳以上のご本人がお申し込みください。</p>
        <SchoolMaterialRequestForm school={school} />
      </> : <p>現在、この学校の資料請求は受け付けていません。</p>}
    </div>
  );
}
