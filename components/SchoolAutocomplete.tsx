'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Control, Controller, UseFormSetValue, useWatch } from 'react-hook-form';

interface School {
  id: string;
  name: string;
  prefecture: string;
  status: string;
}

interface SchoolAutocompleteProps {
  control: Control<any>;
  name: string;
  setValue: UseFormSetValue<any>;
  placeholder?: string;
  error?: any;
  required?: boolean;
}

export default function SchoolAutocomplete({
  control,
  name,
  setValue,
  placeholder = '学校名を入力してください',
  error,
  required = false,
}: SchoolAutocompleteProps) {
  console.log('[SchoolAutocomplete] コンポーネントマウント:', { name, placeholder });
  
  const [suggestions, setSuggestions] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // field.valueを監視（useWatchを使ってReact Hook Formの値を監視）
  const fieldValue = useWatch({
    control,
    name: name,
    defaultValue: '',
  }) || ''; // undefinedの場合は空文字列に変換
  
  console.log('[SchoolAutocomplete] fieldValue:', fieldValue);

  // 検索API呼び出し（debounce付き）
  const searchSchools = useCallback(async (query: string) => {
    console.log('[SchoolAutocomplete] searchSchools呼び出し:', query);
    
    if (!query || query.length < 1) {
      console.log('[SchoolAutocomplete] クエリが空のため検索をスキップ');
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    console.log('[SchoolAutocomplete] APIリクエスト送信:', `/api/schools/autocomplete?q=${encodeURIComponent(query)}`);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/schools/autocomplete?q=${encodeURIComponent(query)}`);
      console.log('[SchoolAutocomplete] APIレスポンス受信:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'レスポンス解析エラー' }));
        console.error('学校検索APIエラー:', errorData);
        throw new Error(errorData.error || `学校検索に失敗しました (${response.status})`);
      }
      
      const data = await response.json();
      
      // デバッグ用ログ
      console.log('[SchoolAutocomplete] APIレスポンス:', data);
      console.log('[SchoolAutocomplete] 学校数:', data.suggestions?.length || 0);

      // /api/schools/autocomplete は suggestions プロパティを返す
      const schools = (data.suggestions || []).map((suggestion: { id: string; name: string; prefecture: string; slug: string | null }) => ({
        id: suggestion.id,
        name: suggestion.name,
        prefecture: suggestion.prefecture,
        status: 'active' as const, // autocomplete は active のみを返すため
      }));
      
      setSuggestions(schools);
      
      // 候補がある場合のみ表示
      if (schools.length > 0) {
        setShowSuggestions(true);
      } else {
        // 候補がなくても、入力値があれば「追加」オプションを表示するために開く
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('学校検索エラー:', error);
      setSuggestions([]);
      // エラー時でも、入力値があれば「追加」オプションを表示できるようにする
      setShowSuggestions(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 入力値変更時のdebounce処理（fieldValueが変更されたときに実行）
  useEffect(() => {
    console.log('[SchoolAutocomplete] useEffect実行:', { fieldValue, selectedSchool: !!selectedSchool });
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (fieldValue && !selectedSchool) {
      console.log('[SchoolAutocomplete] デバウンスタイマー開始 (200ms):', fieldValue);
      debounceTimerRef.current = setTimeout(() => {
        console.log('[SchoolAutocomplete] デバウンスタイマー発火、検索実行:', fieldValue);
        searchSchools(fieldValue);
      }, 200);
    } else {
      console.log('[SchoolAutocomplete] 検索条件を満たさないため、候補をクリア');
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        console.log('[SchoolAutocomplete] デバウンスタイマークリア');
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fieldValue, selectedSchool, searchSchools]);

  // クリックアウトサイドで候補を閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 学校を追加（その他入力時）
  const createSchool = async (name: string) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/schools/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '学校の追加に失敗しました');
      }

      const data = await response.json();
      const newSchool: School = {
        id: data.id,
        name: data.name,
        prefecture: '不明',
        status: data.status || 'pending',
      };

      setSelectedSchool(newSchool);
      setShowSuggestions(false);
      setSuggestions([]);
      // React Hook Formのフィールドを更新
      setValue(name, newSchool.name);
      setValue('school_id', newSchool.id);
      setValue('school_name_input', name); // その他入力時の原文
    } catch (error) {
      console.error('学校追加エラー:', error);
      alert(error instanceof Error ? error.message : '学校の追加に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? '学校名を選択してください' : false }}
      defaultValue=""
      render={({ field }) => {
        // fieldValueはuseWatchで監視している値を使用
        // field.valueとfieldValueの両方を確認し、常に文字列にする
        const currentValue = field.value || fieldValue || '';
        const displayValue = selectedSchool ? (selectedSchool.name || '') : (currentValue || '');
        
        console.log('[SchoolAutocomplete] render:', { 
          fieldValue, 
          'field.value': field.value, 
          currentValue, 
          displayValue,
          selectedSchool: selectedSchool?.name 
        });

        return (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              name={name}
              id={name}
              value={displayValue || ''} // 念のため空文字列を保証
              onChange={(e) => {
                const value = e.target.value;
                console.log('[SchoolAutocomplete] input onChange 発火:', value);
                setSelectedSchool(null);
                // React Hook Formのフィールドを更新
                field.onChange(value);
                setValue('school_id', '');
                setValue('school_name_input', '');
              }}
              onFocus={() => {
                console.log('[SchoolAutocomplete] input onFocus 発火');
                if (suggestions.length > 0 || fieldValue) {
                  setShowSuggestions(true);
                }
              }}
            placeholder={placeholder}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
            style={{
              borderRadius: 'var(--ce-radius-control)',
              borderColor: error ? '#ef4444' : 'var(--ce-border)',
              borderWidth: error ? '2px' : '1px',
              fontFamily: 'var(--ce-font-body)',
              ...(error ? {
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                '--tw-ring-color': '#ef4444'
              } : {
                '--tw-ring-color': 'var(--ce-primary)'
              } as React.CSSProperties)
            }}
            disabled={isCreating}
          />
          
          {/* 候補リスト */}
          {showSuggestions && (suggestions.length > 0 || (fieldValue && !selectedSchool)) && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
              style={{
                borderRadius: 'var(--ce-radius-control)',
              }}
            >
              {isLoading && (
                <div className="px-4 py-2 text-sm text-gray-500">検索中...</div>
              )}
              
              {!isLoading && suggestions.length > 0 && (
                <>
                  {suggestions.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => {
                        setSelectedSchool(school);
                        setShowSuggestions(false);
                        // React Hook Formのフィールドを更新
                        field.onChange(school.name);
                        setValue('school_id', school.id);
                        setValue('school_name_input', '');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{school.name}</span>
                      </div>
                      {school.status === 'pending' && (
                        <div className="text-xs text-gray-500 mt-1">（仮登録）</div>
                      )}
                    </button>
                  ))}
                </>
              )}
              
              {/* 候補が見つからない場合の「追加」オプション */}
              {!isLoading && suggestions.length === 0 && fieldValue && !selectedSchool && (
                <button
                  type="button"
                  onClick={() => {
                    createSchool(fieldValue);
                  }}
                  disabled={isCreating || fieldValue.trim().length < 2 || fieldValue.trim().length > 40}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-t border-gray-200"
                  style={{
                    backgroundColor: isCreating ? '#f3f4f6' : undefined,
                  }}
                >
                  <div className="text-sm text-blue-600 font-medium">
                    候補が見つかりませんでした
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    「{fieldValue}」を追加して続ける
                  </div>
                  {isCreating && (
                    <div className="text-xs text-gray-500 mt-1">追加中...</div>
                  )}
                </button>
              )}
            </div>
          )}
          
          </div>
        );
      }}
    />
  );
}

