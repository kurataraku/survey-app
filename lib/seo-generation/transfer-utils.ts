export function generateSeoSlug(keyword: string, title: string): string {
  const mappings: Record<string, string> = {
    '通信制高校': 'tsushinsei-koukou',
    'デメリット': 'demerit',
    'メリット': 'merit',
    '学費': 'tuition',
    '口コミ': 'reviews',
    '評判': 'reputation',
    '比較': 'comparison',
    '選び方': 'how-to-choose',
    'おすすめ': 'recommended',
    'ランキング': 'ranking',
    '転入': 'transfer',
    '編入': 'transfer-admission',
    '不登校': 'futoukou',
    'サポート校': 'support-school',
    'スクーリング': 'schooling',
    '卒業': 'graduation',
    '進学': 'higher-education',
    '就職': 'employment',
    '学費安い': 'affordable-tuition',
    '単位': 'credits',
    'レポート': 'reports',
    '先生': 'teachers',
    '体験談': 'experiences',
    '入学': 'enrollment',
    '高校': 'high-school',
    '大学受験': 'university-exam',
  };

  const terms = keyword.split(/[\s　]+/).filter(t => t.length > 0);
  const slugParts: string[] = [];

  for (const term of terms) {
    if (mappings[term]) {
      slugParts.push(mappings[term]);
    } else {
      let found = false;
      for (const [jp, en] of Object.entries(mappings)) {
        if (term.includes(jp)) {
          slugParts.push(en);
          found = true;
          break;
        }
      }
      if (!found && /^[a-zA-Z0-9-]+$/.test(term)) {
        slugParts.push(term.toLowerCase());
      }
    }
  }

  if (slugParts.length === 0) {
    return `article-${Date.now().toString(36)}`;
  }

  return slugParts.join('-');
}

export function cleanMdBody(raw: string): string {
  let s = raw;
  // Remove wrapping ```markdown code fences
  s = s.replace(/^```(?:markdown|md)?\s*\n?/i, '');
  s = s.replace(/\n?```\s*$/i, '');
  // Remove SEO_META section
  const idx = s.search(/SEO_META/);
  if (idx !== -1) s = s.slice(0, idx);
  // Remove trailing JSON meta block
  s = s.replace(/\n\s*\{\s*"metaTitle"[\s\S]*\}\s*$/, '');
  // Remove trailing code fences and horizontal rules
  s = s.replace(/\n*```\s*$/g, '');
  s = s.replace(/\n*-{3,}\s*$/g, '');
  return s.trim();
}

export function mdToHtml(md: string): string {
  let h = md;
  // Headings (h3 before h2 before h1 to avoid partial matches)
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold and italic
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links
  h = h.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Images
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // Blockquotes
  h = h.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/<\/blockquote>\n<blockquote>/g, '\n');
  // Horizontal rules
  h = h.replace(/^---$/gm, '<hr />');
  // Unordered lists
  h = h.replace(/(?:^[-*] .+$\n?)+/gm, (m) => {
    const items = m
      .trim()
      .split('\n')
      .map((l) => '<li>' + l.replace(/^[-*] /, '') + '</li>')
      .join('\n');
    return '<ul>\n' + items + '\n</ul>';
  });
  // Ordered lists
  h = h.replace(/(?:^\d+\. .+$\n?)+/gm, (m) => {
    const items = m
      .trim()
      .split('\n')
      .map((l) => '<li>' + l.replace(/^\d+\. /, '') + '</li>')
      .join('\n');
    return '<ol>\n' + items + '\n</ol>';
  });
  // Wrap remaining text lines in <p> tags
  const lines = h.split('\n');
  const out: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      const t = buf.join(' ').trim();
      if (t) out.push('<p>' + t + '</p>');
      buf = [];
    }
  };
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) {
      flush();
      continue;
    }
    if (
      /^<(?:h[1-6]|ul|ol|li|blockquote|hr|p|div|table|img|br)[\s/>]/i.test(
        t
      ) ||
      /^<\/(?:h[1-6]|ul|ol|li|blockquote|p|div|table)>/i.test(t)
    ) {
      flush();
      out.push(ln);
    } else {
      buf.push(t);
    }
  }
  flush();
  return out.join('\n');
}
