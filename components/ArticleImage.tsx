import Image from 'next/image';
import { isOptimizableArticleImage } from '@/lib/images/articleImages';

type ArticleImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
} & ({ fill: true } | { fill?: false; width: number; height: number });

/**
 * 記事のアイキャッチ画像。Supabase Storage の画像は Next.js の画像最適化で表示幅に縮めて配信する。
 * next.config の remotePatterns にないホストを next/image に渡すと描画が失敗するため、その場合は <img> にする。
 */
export default function ArticleImage(props: ArticleImageProps) {
  const { src, alt, sizes, className, priority = false } = props;
  if (isOptimizableArticleImage(src)) {
    return props.fill ? (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />
    ) : (
      <Image
        src={src}
        alt={alt}
        width={props.width}
        height={props.height}
        sizes={sizes}
        className={className}
        priority={priority}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
