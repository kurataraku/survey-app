import { createClient } from '@supabase/supabase-js';

/**
 * answer_schema テーブルの定義
 */
export interface AnswerSchema {
  key: string;
  type: 'string' | 'number' | 'string[]' | 'number[]' | 'boolean';
  required: boolean;
  enum_values: string[] | null;
  aliases: string[] | null;
  description: string | null;
}

/**
 * 正規化されたanswersオブジェクト
 */
export type NormalizedAnswers = Record<string, any>;

/**
 * answersのキーを正規化する関数
 * 
 * @param rawAnswers - 正規化前のanswersオブジェクト
 * @param supabaseUrl - SupabaseのURL
 * @param supabaseServiceKey - SupabaseのService Role Key
 * @returns 正規化されたanswersオブジェクト
 */
export async function normalizeAnswers(
  rawAnswers: Record<string, any>,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<NormalizedAnswers> {
  // Supabaseクライアントを作成
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // answer_schemaを取得
  const { data: schemas, error } = await supabase
    .from('answer_schema')
    .select('*');

  if (error) {
    console.error('answer_schema取得エラー:', error);
    // エラー時は空のオブジェクトを返す（安全な動作）
    return {};
  }

  if (!schemas || schemas.length === 0) {
    console.warn('answer_schemaが空です。正規化をスキップします。');
    return {};
  }

  // キー名のマッピング（正規キー -> aliases）を作成
  const aliasToKeyMap = new Map<string, string>();
  const schemaMap = new Map<string, AnswerSchema>();

  for (const schema of schemas) {
    schemaMap.set(schema.key, schema);
    
    // aliasesから正規キーへのマッピングを作成
    if (schema.aliases && schema.aliases.length > 0) {
      for (const alias of schema.aliases) {
        aliasToKeyMap.set(alias, schema.key);
      }
    }
    
    // 正規キー自体もマッピングに追加（自分自身へのマッピング）
    aliasToKeyMap.set(schema.key, schema.key);
  }

  // 正規化されたanswersオブジェクト
  const normalized: NormalizedAnswers = {};

  // 入力された各キーを処理
  for (const [inputKey, value] of Object.entries(rawAnswers)) {
    // 正規キーを取得（aliasesがあれば変換、なければ入力キーをそのまま使用）
    const normalizedKey = aliasToKeyMap.get(inputKey);
    
    if (!normalizedKey) {
      // スキーマに存在しないキーは破棄
      console.warn(`スキーマに存在しないキーを破棄: ${inputKey}`);
      continue;
    }

    // スキーマを取得
    const schema = schemaMap.get(normalizedKey);
    if (!schema) {
      continue;
    }

    // 値がnullまたはundefinedの場合はスキップ
    if (value === null || value === undefined) {
      continue;
    }

    // 空文字列や空配列は保存しない
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }

    // 型に応じて値を変換・検証
    const convertedValue = convertValueByType(value, schema);
    
    if (convertedValue === null || convertedValue === undefined) {
      // 変換できない値は破棄
      console.warn(`型変換に失敗した値を破棄: ${inputKey} = ${JSON.stringify(value)} (期待される型: ${schema.type})`);
      continue;
    }

    // enum_valuesが定義されている場合、値がenumに含まれているかチェック
    if (schema.enum_values && schema.enum_values.length > 0) {
      const valueToCheck = Array.isArray(convertedValue) 
        ? convertedValue 
        : [convertedValue];
      
      const isValid = valueToCheck.every(v => schema.enum_values!.includes(String(v)));
      
      if (!isValid) {
        console.warn(`enum値チェックに失敗した値を破棄: ${inputKey} = ${JSON.stringify(value)} (許可された値: ${schema.enum_values.join(', ')})`);
        continue;
      }
    }

    // 正規化された値を設定
    normalized[normalizedKey] = convertedValue;
  }

  return normalized;
}

/**
 * スキーマの型に応じて値を変換する関数
 * 
 * @param value - 変換前の値
 * @param schema - スキーマ定義
 * @returns 変換された値（変換できない場合はnull）
 */
function convertValueByType(
  value: any,
  schema: AnswerSchema
): any {
  try {
    switch (schema.type) {
      case 'string':
        // 文字列に変換
        return String(value);

      case 'number': {
        // 数値に変換（文字列の数値も受け入れる）
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (isNaN(num)) {
          return null;
        }
        return num;
      }

      case 'string[]':
        // 配列に変換（既に配列の場合はそのまま、文字列の場合は配列に変換）
        if (Array.isArray(value)) {
          return value.map(v => String(v)).filter(v => v !== '');
        }
        if (typeof value === 'string' && value !== '') {
          return [value];
        }
        return null;

      case 'number[]': {
        // 数値配列に変換
        if (Array.isArray(value)) {
          const nums = value.map(v => typeof v === 'string' ? parseFloat(v) : Number(v));
          if (nums.some(n => isNaN(n))) {
            return null;
          }
          return nums;
        }
        // 単一の数値の場合も配列に変換
        const singleNum = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (isNaN(singleNum)) {
          return null;
        }
        return [singleNum];
      }

      case 'boolean':
        // ブール値に変換
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'yes';
        }
        return Boolean(value);

      default:
        return null;
    }
  } catch (error) {
    console.error(`型変換エラー (${schema.key}):`, error);
    return null;
  }
}



