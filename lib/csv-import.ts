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

/**
 * CSV 1行をインポート用オブジェクトに変換
 */
function csvRowToImportRow(
  headers: string[],
  values: string[],
  rowIndex: number
): { data: SurveyImportRow } | { error: string } {
  const get = (fieldName: string): string => {
    const idx = headers.indexOf(fieldName);
    if (idx < 0 || idx >= values.length) return '';
    const v = values[idx];
    return typeof v === 'string' ? v.trim() : '';
  };

  const schoolName = get(EXPORT_CSV_HEADERS[2]);
  const respondentRole = get(EXPORT_CSV_HEADERS[3]);
  const status = get(EXPORT_CSV_HEADERS[4]);
  const reasonRaw = get(EXPORT_CSV_HEADERS[7]);
  const teachingStyleRaw = get(EXPORT_CSV_HEADERS[13]);
  const studentAtmosphereRaw = get(EXPORT_CSV_HEADERS[14]);

  if (!schoolName) {
    return { error: '学校名が空です' };
  }

  const data: SurveyImportRow = {
    school_name: schoolName,
    respondent_role: respondentRole || '',
    status: status || '',
    graduation_path: emptyToUndefined(get(EXPORT_CSV_HEADERS[5])),
    graduation_path_other: emptyToUndefined(get(EXPORT_CSV_HEADERS[6])),
    reason_for_choosing: splitSemicolon(reasonRaw),
    course: emptyToUndefined(get(EXPORT_CSV_HEADERS[8])),
    enrollment_type: get(EXPORT_CSV_HEADERS[9]),
    enrollment_year: get(EXPORT_CSV_HEADERS[10]),
    attendance_frequency: get(EXPORT_CSV_HEADERS[11]),
    campus_prefecture: get(EXPORT_CSV_HEADERS[12]),
    teaching_style: splitSemicolon(teachingStyleRaw),
    student_atmosphere: splitSemicolon(studentAtmosphereRaw),
    atmosphere_other: emptyToUndefined(get(EXPORT_CSV_HEADERS[15])),
    flexibility_rating: get(EXPORT_CSV_HEADERS[16]),
    staff_rating: get(EXPORT_CSV_HEADERS[17]),
    support_rating: get(EXPORT_CSV_HEADERS[18]),
    atmosphere_fit_rating: get(EXPORT_CSV_HEADERS[19]),
    credit_rating: get(EXPORT_CSV_HEADERS[20]),
    unique_course_rating: get(EXPORT_CSV_HEADERS[21]),
    career_support_rating: get(EXPORT_CSV_HEADERS[22]),
    campus_life_rating: get(EXPORT_CSV_HEADERS[23]),
    tuition_rating: get(EXPORT_CSV_HEADERS[24]),
    overall_satisfaction: get(EXPORT_CSV_HEADERS[25]),
    good_comment: get(EXPORT_CSV_HEADERS[26]),
    bad_comment: get(EXPORT_CSV_HEADERS[27]),
    email: get(EXPORT_CSV_HEADERS[28]),
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
