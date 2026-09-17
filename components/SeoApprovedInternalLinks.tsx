import { createAdminSupabaseClient } from '@/lib/supabase/server';

type Props = {
  sourceUrl: string;
};

type ApprovedLinkRow = {
  id: string;
  target_url: string;
  anchor_text: string;
};

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.toString();
}

export default async function SeoApprovedInternalLinks({ sourceUrl }: Props) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('seo_approved_internal_links')
    .select('id,target_url,anchor_text')
    .eq('source_url', normalizedUrl(sourceUrl))
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(5);

  if (error || !data || data.length === 0) return null;
  const links = data as ApprovedLinkRow[];

  return (
    <aside
      aria-labelledby="seo-approved-related-links"
      className="bg-white rounded-lg shadow-sm p-6 mb-6"
    >
      <h2
        id="seo-approved-related-links"
        className="text-xl font-bold text-gray-900 mb-3"
      >
        関連ページ
      </h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.target_url}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {link.anchor_text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
