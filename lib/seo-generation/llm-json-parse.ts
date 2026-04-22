/**
 * LLM 出力から単一の JSON オブジェクトを取り出してパースする（説明文・```json フェンス・前後ゴミに耐性）。
 */
export function stripMarkdownJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/** 先頭の `{` から括弧バランスが取れる位置までを切り出す（文字列内の `"` / `\` を考慮） */
export function extractFirstJsonObject(text: string): string | null {
  const s = stripMarkdownJsonFence(text);
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** 末尾の余分なカンマを除去（一部モデルが出力する） */
export function repairTrailingCommasInJson(json: string): string {
  return json.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonObjectFromLlmText<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  let candidate =
    extractFirstJsonObject(trimmed) ||
    (() => {
      const m = trimmed.match(/\{[\s\S]*\}/);
      return m ? m[0] : null;
    })();
  if (!candidate) {
    throw new SyntaxError('JSONオブジェクトが見つかりません');
  }
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return JSON.parse(repairTrailingCommasInJson(candidate)) as T;
  }
}
