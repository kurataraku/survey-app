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

/**
 * 根拠カード（review）の学校ページ URL から schools.slug を抽出する。
 * 転送時に article_schools を自動作成するために使う（並びは evidence の SELECT 順に依存）。
 */
export function schoolSlugsFromReviewEvidenceUrls(
  evidence: Array<{ kind: string; url: string | null }>
): string[] {
  const slugRe = /\/schools\/([^/?#]+)/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of evidence) {
    if (e.kind !== 'review' || !e.url) continue;
    const m = e.url.match(slugRe);
    if (!m) continue;
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* そのまま */
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/**
 * GitHub Flavored Markdown 形式の表（| 区切り + 区切り行）を HTML に変換する。
 * 転送先の articles.content は簡易 mdToHtml 経由のため、プレビュー（remark-gfm）と同様に表を残す。
 * 出力は1行の <table> ブロック（段落ラッパーとの干渉を避ける）。
 */
function splitMdTableRow(line: string): string[] {
  const t = line.trim();
  let s = t;
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function looksLikeMdTableRow(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.includes('|');
}

function isMdTableSeparatorRow(line: string): boolean {
  const cells = splitMdTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => {
    const c = cell.replace(/\s/g, '');
    return /^:?-{3,}:?$/.test(c) || /^:?={3,}:?$/.test(c);
  });
}

function formatTableCellInlineMd(cell: string): string {
  let s = cell.trim();
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return s;
}

function convertPipeTablesToHtml(md: string): string {
  const text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const row0 = lines[i];
    const row1 = i + 1 < lines.length ? lines[i + 1] : '';
    if (
      row0.trim() &&
      row1.trim() &&
      looksLikeMdTableRow(row0) &&
      isMdTableSeparatorRow(row1)
    ) {
      const headerCells = splitMdTableRow(row0);
      if (headerCells.length === 0 || headerCells.every((c) => !c)) {
        out.push(row0);
        i++;
        continue;
      }
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length) {
        const ln = lines[i];
        if (!ln.trim()) break;
        if (!looksLikeMdTableRow(ln)) break;
        if (isMdTableSeparatorRow(ln)) {
          i++;
          continue;
        }
        bodyRows.push(splitMdTableRow(ln));
        i++;
      }
      const th = headerCells
        .map((c) => `<th>${formatTableCellInlineMd(c)}</th>`)
        .join('');
      const colCount = headerCells.length;
      const trs = bodyRows
        .map((cells) => {
          const padded = [...cells];
          while (padded.length < colCount) padded.push('');
          const slice = padded.slice(0, colCount);
          const tds = slice
            .map((c) => `<td>${formatTableCellInlineMd(c)}</td>`)
            .join('');
          return `<tr>${tds}</tr>`;
        })
        .join('');
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
    } else {
      out.push(row0);
      i++;
    }
  }
  return out.join('\n');
}

export function mdToHtml(md: string): string {
  let h = convertPipeTablesToHtml(md);
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
