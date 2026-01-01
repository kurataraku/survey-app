'use client';

import Link from 'next/link';

interface ArticleCardProps {
  id: string;
  title: string;
  slug: string;
  category: 'interview' | 'useful_info';
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
}

export default function ArticleCard({
  id,
  title,
  slug,
  category,
  excerpt,
  featured_image_url,
  published_at,
}: ArticleCardProps) {
  const getCategoryLabel = () => {
    switch (category) {
      case 'interview':
        return 'リアル体験談 クチコミ・インタビュー';
      case 'useful_info':
        return '通信制高校お役立ち情報';
      default:
        return category;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Link
      href={`/features/${encodeURIComponent(slug)}`}
      className="block bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-orange-300 hover:shadow-md transition-all"
    >
      {featured_image_url && (
        <div className="aspect-video w-full bg-gray-200 overflow-hidden">
          <img
            src={featured_image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-6">
        <div className="mb-2">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            {getCategoryLabel()}
          </span>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>
        {excerpt && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">{excerpt}</p>
        )}
        {published_at && (
          <p className="text-xs text-gray-500">{formatDate(published_at)}</p>
        )}
      </div>
    </Link>
  );
}



