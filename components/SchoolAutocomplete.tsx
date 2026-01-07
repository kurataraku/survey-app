'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Control, Controller, UseFormSetValue } from 'react-hook-form';

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
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 検索API呼び出し（debounce付き）
  const searchSchools = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/schools/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('学校検索に失敗しました');
      }
      const data = await response.json();
      setSuggestions(data.schools || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('学校検索エラー:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 入力値変更時のdebounce処理
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (inputValue && !selectedSchool) {
      debounceTimerRef.current = setTimeout(() => {
        searchSchools(inputValue);
      }, 250);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, selectedSchool, searchSchools]);

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
      setInputValue(newSchool.name);
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
      render={({ field }) => (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={selectedSchool ? selectedSchool.name : inputValue}
            onChange={(e) => {
              const value = e.target.value;
              setInputValue(value);
              setSelectedSchool(null);
              // React Hook Formのフィールドをクリア
              setValue(name, '');
              setValue('school_id', '');
              setValue('school_name_input', '');
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
            style={{
              borderRadius: 'var(--ce-radius-control)',
              borderColor: error ? 'var(--ce-warning)' : 'var(--ce-border)',
              fontFamily: 'var(--ce-font-body)',
              ...(error ? {} : {
                '--tw-ring-color': 'var(--ce-primary)'
              } as React.CSSProperties)
            }}
            disabled={isCreating}
          />
          
          {/* 候補リスト */}
          {showSuggestions && (suggestions.length > 0 || (inputValue && !selectedSchool)) && (
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
                        setInputValue(school.name);
                        setShowSuggestions(false);
                        // React Hook Formのフィールドを更新
                        setValue(name, school.name);
                        setValue('school_id', school.id);
                        setValue('school_name_input', '');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{school.name}</span>
                        {school.prefecture && school.prefecture !== '不明' && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {school.prefecture}
                          </span>
                        )}
                      </div>
                      {school.status === 'pending' && (
                        <div className="text-xs text-gray-500 mt-1">（仮登録）</div>
                      )}
                    </button>
                  ))}
                </>
              )}
              
              {/* 候補が見つからない場合の「追加」オプション */}
              {!isLoading && suggestions.length === 0 && inputValue && !selectedSchool && (
                <button
                  type="button"
                  onClick={() => {
                    createSchool(inputValue);
                  }}
                  disabled={isCreating || inputValue.trim().length < 2 || inputValue.trim().length > 40}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-t border-gray-200"
                  style={{
                    backgroundColor: isCreating ? '#f3f4f6' : undefined,
                  }}
                >
                  <div className="text-sm text-blue-600 font-medium">
                    候補が見つかりませんでした
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    「{inputValue}」を追加して続ける
                  </div>
                  {isCreating && (
                    <div className="text-xs text-gray-500 mt-1">追加中...</div>
                  )}
                </button>
              )}
            </div>
          )}
          
        </div>
      )}
    />
  );
}

