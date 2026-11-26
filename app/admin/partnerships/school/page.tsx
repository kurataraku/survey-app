import Link from 'next/link';
import SchoolPortal from '@/components/partnerships/SchoolPortal';
import { appPath } from '@/lib/base-path';
import { uuid } from '@/lib/partnerships/model';

// 運営が学校の管理画面を代わりに表示する（閲覧と、写真・メッセージ・公式サイトのリンクの代理登録）
export default async function PartnershipSchoolViewPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school } = await searchParams;
  const id = uuid.safeParse(school);
  if (!id.success) {
    return <main className="mx-auto max-w-3xl space-y-3 px-4 py-8">
      <p>学校が指定されていません。</p>
      <Link className="text-blue-700 underline" href={appPath('/admin/partnerships')}>学校提携・資料請求に戻る</Link>
    </main>;
  }
  return <SchoolPortal operatorSchoolId={id.data} />;
}
