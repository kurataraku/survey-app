'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownHref } from '@/lib/links/normalizeMarkdownHref';

interface MarkdownRendererProps {
  content: string;
}

/** 角括弧URL `<https://...>` は Markdown でもよく使われ、`<[a-z]` 判定で誤って HTML 扱いになるため除外しない */
const RICH_HTML_OPEN_TAG =
  /<(p|div|span|br|strong|em|b|i|u|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|a|img|section|article|figure|figcaption)\b/i;

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const looksLikeSavedRichHtml = RICH_HTML_OPEN_TAG.test(content);

  if (looksLikeSavedRichHtml) {
    // HTMLコンテンツとして表示
    return (
      <div
        className="prose prose-lg max-w-none article-content"
        dangerouslySetInnerHTML={{ __html: content }}
        style={{
          fontSize: '16px',
          lineHeight: '1.6',
        }}
      />
    );
  }

  // Markdownコンテンツとして表示（既存のコンテンツとの互換性）
  return (
    <div className="prose prose-lg max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-gray-900 mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">{children}</ol>
          ),
          li: ({ children }) => <li className="ml-4">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          a: ({ href, children }) => {
            const normalized = normalizeMarkdownHref(href ?? undefined);
            if (normalized.internal) {
              return (
                <Link
                  href={normalized.href}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-gray-300 text-sm text-gray-800">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
          th: ({ children }) => (
            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-2 align-top">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}




