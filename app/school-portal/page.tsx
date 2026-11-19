import type { Metadata } from 'next';
import SchoolPortal from '@/components/partnerships/SchoolPortal';

export const metadata: Metadata = { title: '学校向け管理画面', robots: { index: false, follow: false } };

export default function SchoolPortalPage() {
  return <SchoolPortal />;
}
