/**
 * CSVインポート用ユーティリティ
 * エクスポートCSVと同じフォーマットをパースし、surveySchema互換のオブジェクトに変換する
 */

import type { z } from 'zod';

/** エクスポートCSVと同じヘッダー（テンプレート・マッピング用） */
export const EXPORT_CSV_HEADERS = [
  'ID',
  '送信日時',
  'どの通信制高校についての口コミですか？（学校名）',
  'あなたの立場',
  '状況',
  '卒業後の進路',
  '卒業後の進路（その他）',
  '通信制を選んだ理由',
  '在籍していたコース',
  '入学タイミング',
  '入学年',
  '主な通学頻度',
  '主に通っていたキャンパス都道府県',
  '授業スタイル',
  '生徒の雰囲気',
  'その他（生徒の雰囲気）',
  '学びの柔軟さ（評価）',
  '先生・職員の対応（評価）',
  '心や体調の波・不安などに対するサポート（評価）',
  '在校生の雰囲気が自分に合っていたか（評価）',
  '単位取得のしやすさ（評価）',
  '独自授業・コースの充実度（評価）',
  '進路サポート（評価）',
  '行事やキャンパスライフの過ごしやすさ（評価）',
  '学費の納得感（評価）',
  '総合満足度',
  '良かった点（自由記述）',
  '改善してほしい点/合わない点（自由記述）',
  'メールアドレス',
] as const;

/** バリデーションの path（フィールド名）→ 表示用の列名 */
export const VALIDATION_FIELD_LABELS: Record<string, string> = {
  school_name: 'どの通信制高校についての口コミですか？（学校名）',
  respondent_role: 'あなたの立場',
  status: '状況',
  graduation_path: '卒業後の進路',
  graduation_path_other: '卒業後の進路（その他）',
  reason_for_choosing: '通信制を選んだ理由',
  course: '在籍していたコース',
  enrollment_type: '入学タイミング',
  enrollment_year: '入学年',
  attendance_frequency: '主な通学頻度',
  campus_prefecture: '主に通っていたキャンパス都道府県',
  teaching_style: '授業スタイル',
  student_atmosphere: '生徒の雰囲気',
  atmosphere_other: 'その他（生徒の雰囲気）',
  flexibility_rating: '学びの柔軟さ（評価）',
  staff_rating: '先生・職員の対応（評価）',
  support_rating: '心や体調の波・不安などに対するサポート（評価）',
  atmosphere_fit_rating: '在校生の雰囲気が自分に合っていたか（評価）',
  credit_rating: '単位取得のしやすさ（評価）',
  unique_course_rating: '独自授業・コースの充実度（評価）',
  career_support_rating: '進路サポート（評価）',
  campus_life_rating: '行事やキャンパスライフの過ごしやすさ（評価）',
  tuition_rating: '学費の納得感（評価）',
  overall_satisfaction: '総合満足度',
  good_comment: '良かった点（自由記述）',
  bad_comment: '改善してほしい点/合わない点（自由記述）',
  email: 'メールアドレス',
};

/** フィールド名 → CSVの列番号（1始まり。ID=1, 送信日時=2, 学校名=3...） */
export const VALIDATION_FIELD_COLUMN: Record<string, number> = {
  school_name: 3,
  respondent_role: 4,
  status: 5,
  graduation_path: 6,
  graduation_path_other: 7,
  reason_for_choosing: 8,
  course: 9,
  enrollment_type: 10,
  enrollment_year: 11,
  attendance_frequency: 12,
  campus_prefecture: 13,
  teaching_style: 14,
  student_atmosphere: 15,
  atmosphere_other: 16,
  flexibility_rating: 17,
  staff_rating: 18,
  support_rating: 19,
  atmosphere_fit_rating: 20,
  credit_rating: 21,
  unique_course_rating: 22,
  career_support_rating: 23,
  campus_life_rating: 24,
  tuition_rating: 25,
  overall_satisfaction: 26,
  good_comment: 27,
  bad_comment: 28,
  email: 29,
};

/** 1行分のインポート用データ（API送信前の形状。school_id は API で解決） */
export interface SurveyImportRow {
  school_name: string;
  respondent_role: string;
  status: string;
  graduation_path?: string;
  graduation_path_other?: string;
  reason_for_choosing: string[];
  course?: string;
  enrollment_type: string;
  enrollment_year: string;
  attendance_frequency: string;
  campus_prefecture: string;
  teaching_style: string[];
  student_atmosphere: string[];
  atmosphere_other?: string;
  flexibility_rating: string;
  staff_rating: string;
  support_rating: string;
  atmosphere_fit_rating: string;
  credit_rating: string;
  unique_course_rating: string;
  career_support_rating: string;
  campus_life_rating: string;
  tuition_rating: string;
  overall_satisfaction: string;
  good_comment: string;
  bad_comment: string;
  email: string;
}

export interface ParseCsvResult {
  headers: string[];
  rows: SurveyImportRow[];
  parseErrors: Array<{ rowIndex: number; message: string }>;
}

/**
 * CSV文字列をパース（BOM除去・ダブルクォート対応）
 */
function parseCsvLines(csvText: string): string[][] {
  const trimmed = csvText.replace(/^\uFEFF/, '').trim();
  const lines: string[][] = [];
  let i = 0;

  while (i < trimmed.length) {
    const row: string[] = [];
    let field = '';

    while (i < trimmed.length) {
      const c = trimmed[i];

      if (c === '"') {
        i += 1;
        while (i < trimmed.length) {
          if (trimmed[i] === '"') {
            if (trimmed[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i += 1;
              break;
            }
          } else {
            field += trimmed[i];
            i += 1;
          }
        }
        continue;
      }

      if (c === ',') {
        row.push(field);
        field = '';
        i += 1;
        continue;
      }

      if (c === '\r' && trimmed[i + 1] === '\n') {
        row.push(field);
        lines.push(row);
        field = '';
        i += 2;
        continue;
      }

      if (c === '\n' || c === '\r') {
        row.push(field);
        lines.push(row);
        field = '';
        i += 1;
        continue;
      }

      field += c;
      i += 1;
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      lines.push(row);
    }
  }

  return lines;
}

/**
 * セミコロン区切り文字列を配列に変換（空は空配列）
 */
function splitSemicolon(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value.split(/[;；]\s*/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 空文字を undefined に
 */
function emptyToUndefined(s: string): string | undefined {
  const t = s?.trim();
  return t === '' ? undefined : t;
}

/** メールアドレス用：全角＠を半角@に置換（IME全角入力で入力されても通るようにする） */
function normalizeEmailForImport(value: string): string {
  const t = value?.trim() ?? '';
  return t.replace(/\uFF20/g, '@'); // 全角＠ → 半角@
}

/**
 * 主な通学頻度用：チルダ・全角チルダを波ダッシュに統一（enumは 〜 U+301C のみ有効）
 * 例: 週3~4 → 週3〜4, 月1～月数回 → 月1〜数回
 */
function normalizeAttendanceFrequency(value: string): string {
  const t = value?.trim() ?? '';
  const waveDash = '\u301C'; // 波ダッシュ
  let s = t.replace(/\u007E/g, waveDash).replace(/\uFF5E/g, waveDash); // 半角~ と 全角～
  if (s.includes('月数回')) s = s.replace('月数回', '数回'); // 「月1～月数回」→「月1〜数回」
  return s;
}

/** 括弧を全角に統一し、前後のスペースを除去（スキーマのenumは全角（）のみ有効） */
function normalizeEnumParens(value: string): string {
  const t = value?.trim() ?? '';
  return t
    .replace(/\s*\(\s*/g, '\uFF08') // 半角( と前後スペース → 全角（
    .replace(/\s*\)\s*/g, '\uFF09'); // 半角) と前後スペース → 全角）
}

/** 評価1〜5用：数値や "5.0" を "1"〜"5" に正規化 */
function normalizeRating1to5(value: string): string {
  const t = value?.trim() ?? '';
  const n = Math.round(Number(t));
  if (Number.isFinite(n) && n >= 1 && n <= 5) return String(n);
  return t;
}

/** 評価1〜6用：数値や "6.0" を "1"〜"6" に正規化 */
function normalizeRating1to6(value: string): string {
  const t = value?.trim() ?? '';
  const n = Math.round(Number(t));
  if (Number.isFinite(n) && n >= 1 && n <= 6) return String(n);
  return t;
}

/**
 * CSV 1行をインポート用オブジェクトに変換
 */
function csvRowToImportRow(
  headers: string[],
  values: string[],
  rowIndex: number
): { data: SurveyImportRow } | { error: string } {
  const get = (fieldName: string, headerIndex: number): string => {
    let idx = headers.indexOf(fieldName);
    if (idx < 0 && headerIndex >= 0 && headerIndex < values.length) idx = headerIndex; // ヘッダー名不一致時は列位置で取得（Excelで短縮されても読める）
    if (idx < 0 || idx >= values.length) return '';
    const v = values[idx];
    return String(v ?? '').trim();
  };

  const H = EXPORT_CSV_HEADERS;
  const schoolName = get(H[2], 2);
  const respondentRole = get(H[3], 3);
  const status = get(H[4], 4);
  const reasonRaw = get(H[7], 7);
  const teachingStyleRaw = get(H[13], 13);
  const studentAtmosphereRaw = get(H[14], 14);

  if (!schoolName) {
    return { error: '学校名が空です' };
  }

  const data: SurveyImportRow = {
    school_name: schoolName,
    respondent_role: respondentRole || '',
    status: normalizeEnumParens(status || ''),
    graduation_path: emptyToUndefined(get(H[5], 5)),
    graduation_path_other: emptyToUndefined(get(H[6], 6)),
    reason_for_choosing: splitSemicolon(reasonRaw),
    course: emptyToUndefined(get(H[8], 8)),
    enrollment_type: normalizeEnumParens(get(H[9], 9)),
    enrollment_year: get(H[10], 10),
    attendance_frequency: normalizeAttendanceFrequency(get(H[11], 11)),
    campus_prefecture: get(H[12], 12),
    teaching_style: splitSemicolon(teachingStyleRaw),
    student_atmosphere: splitSemicolon(studentAtmosphereRaw),
    atmosphere_other: emptyToUndefined(get(H[15], 15)),
    flexibility_rating: normalizeRating1to5(get(H[16], 16)),
    staff_rating: normalizeRating1to5(get(H[17], 17)),
    support_rating: normalizeRating1to5(get(H[18], 18)),
    atmosphere_fit_rating: normalizeRating1to5(get(H[19], 19)),
    credit_rating: normalizeRating1to5(get(H[20], 20)),
    unique_course_rating: normalizeRating1to6(get(H[21], 21)),
    career_support_rating: normalizeRating1to5(get(H[22], 22)),
    campus_life_rating: normalizeRating1to6(get(H[23], 23)),
    tuition_rating: normalizeRating1to6(get(H[24], 24)),
    overall_satisfaction: normalizeRating1to5(get(H[25], 25)),
    good_comment: get(H[26], 26),
    bad_comment: get(H[27], 27),
    email: normalizeEmailForImport(get(H[28], 28)),
  };

  return { data };
}

/**
 * CSV文字列をパースし、インポート用行の配列に変換する
 */
export function parseCsvToImportRows(csvText: string): ParseCsvResult {
  const parseErrors: Array<{ rowIndex: number; message: string }> = [];
  const lines = parseCsvLines(csvText);

  if (lines.length === 0) {
    return { headers: [], rows: [], parseErrors: [{ rowIndex: 0, message: 'CSVにデータがありません' }] };
  }

  const headers = lines[0].map((h) => h.trim());
  const dataLines = lines.slice(1);
  const rows: SurveyImportRow[] = [];

  const expectedMinColumns = EXPORT_CSV_HEADERS.length;
  for (let i = 0; i < dataLines.length; i++) {
    const values = dataLines[i];
    const rowIndex = i + 2; // 1-based, かつヘッダーが1行目

    const isEmptyRow = values.every((cell) => !String(cell).trim());
    if (isEmptyRow) continue;

    if (values.length < expectedMinColumns) {
      parseErrors.push({
        rowIndex,
        message: `列数が不足しています（${values.length}列。必要: ${expectedMinColumns}列以上）`,
      });
      continue;
    }

    const result = csvRowToImportRow(headers, values, rowIndex);
    if ('error' in result && result.error) {
      parseErrors.push({ rowIndex, message: result.error });
      continue;
    }
    rows.push((result as { data: SurveyImportRow }).data);
  }

  return { headers, rows, parseErrors };
}

/** 1行のバリデーション結果 */
export interface RowValidationError {
  rowIndex: number;
  row: SurveyImportRow;
  issues: Array<{ path: (string | number)[]; message: string }>;
}

/**
 * 各行をスキーマで検証し、成功・エラーを分ける
 */
export function validateImportRows<Schema extends z.ZodTypeAny>(
  rows: SurveyImportRow[],
  schema: Schema
): {
  valid: z.infer<Schema>[];
  errors: RowValidationError[];
} {
  const valid: z.infer<Schema>[] = [];
  const errors: RowValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = schema.safeParse(rows[i]);
    if (result.success) {
      valid.push(result.data as z.infer<Schema>);
    } else {
      errors.push({
        rowIndex: i + 1,
        row: rows[i],
        issues: result.error.issues.map((iss) => ({
          path: iss.path as (string | number)[],
          message: iss.message,
        })),
      });
    }
  }

  return { valid, errors };
}

/**
 * テンプレートCSV（ヘッダー行のみ）の内容を返す
 */
export function getTemplateCsvContent(): string {
  const bom = '\uFEFF';
  return bom + EXPORT_CSV_HEADERS.join(',') + '\n';
}
