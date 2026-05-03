import { getPublicArticlesForSchool } from '@/lib/articles/getPublicArticlesForSchool';
import ArticleCardServer from '@/components/ArticleCardServer';

interface SchoolRelatedArticlesServerProps {
  schoolId: string;
}

/** 記事側の article_schools からの逆引き（この学校が登場する特集） */
export default async function SchoolRelatedArticlesServer({ schoolId }: SchoolRelatedArticlesServerProps) {
  const articles = await getPublicArticlesForSchool(schoolId, 6);
  if (articles.length === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm" aria-labelledby="related-articles-heading">
      <h2 id="related-articles-heading" className="text-xl font-bold text-gray-900 mb-4">
        この学校が登場する特集記事
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        通信制高校の選び方や体験談など、関連する特集から深掘りできます。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((a) => (
          <ArticleCardServer
            key={a.id}
            id={a.id}
            title={a.title}
            slug={a.slug}
            category={a.category}
            excerpt={a.excerpt}
            featured_image_url={a.featured_image_url}
            published_at={a.published_at}
          />
        ))}
      </div>
    </section>
  );
}
