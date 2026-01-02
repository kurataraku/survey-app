'use client';

import { useState, useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '本文を入力してください...',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    // エディタにフォーカスを設定
    if (editorRef.current) {
      editorRef.current.focus();
      
      // 選択範囲を保存
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      
      // コマンドを実行
      try {
        if (value !== undefined) {
          document.execCommand(command, false, value);
        } else {
          document.execCommand(command, false);
        }
      } catch (error) {
        console.error('execCommand error:', error);
      }
      
      // 入力イベントをトリガー
      handleInput();
      
      // フォーカスを維持
      editorRef.current.focus();
    }
  };

  const ToolbarButton = ({
    onClick,
    icon,
    title,
    active = false,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    active?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // フォーカスが外れるのを防ぐ
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`
        px-3 py-2 text-sm font-medium rounded transition-colors
        ${active
          ? 'bg-orange-100 text-orange-700'
          : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      {icon}
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-500">
      {/* ツールバー */}
      <div className="border-b border-gray-300 bg-gray-50 p-2 flex flex-wrap gap-1">
        {/* 見出し */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
          <select
            onChange={(e) => {
              e.preventDefault();
              const value = e.target.value;
              if (editorRef.current) {
                editorRef.current.focus();
                if (value === 'p') {
                  execCommand('formatBlock', '<p>');
                } else {
                  execCommand('formatBlock', value);
                }
              }
            }}
            onMouseDown={(e) => {
              // エディタのフォーカスを維持
              if (editorRef.current) {
                editorRef.current.focus();
              }
            }}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
          >
            <option value="p">本文</option>
            <option value="h1">見出し1</option>
            <option value="h2">見出し2</option>
            <option value="h3">見出し3</option>
          </select>
        </div>

        {/* テキストスタイル */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
          <ToolbarButton
            onClick={() => execCommand('bold')}
            title="太字 (Ctrl+B)"
            icon={<span className="font-bold">B</span>}
          />
          <ToolbarButton
            onClick={() => execCommand('italic')}
            title="斜体 (Ctrl+I)"
            icon={<span className="italic">I</span>}
          />
          <ToolbarButton
            onClick={() => execCommand('underline')}
            title="下線 (Ctrl+U)"
            icon={<span className="underline">U</span>}
          />
        </div>

        {/* リスト */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
          <ToolbarButton
            onClick={() => execCommand('insertUnorderedList')}
            title="箇条書き"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            }
          />
          <ToolbarButton
            onClick={() => execCommand('insertOrderedList')}
            title="番号付きリスト"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            }
          />
        </div>

        {/* その他の機能 */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => execCommand('justifyLeft')}
            title="左揃え"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 18h18M3 6h18" />
              </svg>
            }
          />
          <ToolbarButton
            onClick={() => execCommand('justifyCenter')}
            title="中央揃え"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10M3 14h10M3 18h10M3 6h10" />
              </svg>
            }
          />
          <ToolbarButton
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.focus();
                const url = prompt('リンクURLを入力してください:');
                if (url) {
                  execCommand('createLink', url);
                }
              }
            }}
            title="リンク"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
          />
        </div>
      </div>

      {/* エディタエリア */}
      <div className="rich-text-editor">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            min-h-[400px] p-4 outline-none
            ${isFocused ? 'bg-white' : 'bg-white'}
          `}
          style={{
            fontSize: '16px',
            lineHeight: '1.6',
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
      
    </div>
  );
}

