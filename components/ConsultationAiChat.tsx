'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type ChatSource = {
  ref: string;
  index: number;
  id: string;
  sourceType: string;
  title: string;
  schoolName: string | null;
  url: string | null;
};

type SchoolCandidate = {
  name: string;
  url: string;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  sources?: ChatSource[];
  schoolCandidates?: SchoolCandidate[];
  model?: string;
};

type ConsultationAiChatProps = {
  compact?: boolean;
  className?: string;
  onConversationStart?: () => void;
  source?: string;
};

const QUICK_PROMPTS = [
  '不登校経験がある子に合う通信制高校を、東京都で探したいです',
  '人間関係に不安がある子に合う通信制高校の選び方を知りたいです',
];

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function linkifyDocRefs(content: string, messageId: string): string {
  return content.replace(/\[doc_(\d+)\]/g, (_, rawIndex: string) => {
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isFinite(index)) return `[doc_${rawIndex}]`;
    return `[\\[${index}\\]](#cite-${messageId}-doc_${index})`;
  });
}

function scrollToCitation(anchorId: string) {
  const element = document.getElementById(anchorId);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  element.classList.add('ring-2', 'ring-blue-300');
  window.setTimeout(() => {
    element.classList.remove('ring-2', 'ring-blue-300');
  }, 1400);
}

export default function ConsultationAiChat({
  compact = false,
  className = '',
  onConversationStart,
  source = 'consultation_ai',
}: ConsultationAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content: 'こんにちは。**通信制高校えらび相談AI**です。',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef('');

  useEffect(() => {
    const key = 'consultation_ai_session_id';
    const existing = sessionStorage.getItem(key);
    if (existing) {
      sessionIdRef.current = existing;
      return;
    }
    const nextId = createId();
    sessionStorage.setItem(key, nextId);
    sessionIdRef.current = nextId;
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const payloadMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  async function sendMessage(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;
    setError(null);

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    onConversationStart?.();
    trackEvent(GA_EVENTS.consultationAiSend, { source });

    try {
      const response = await fetch(apiPath('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        body: JSON.stringify({
          messages: [...payloadMessages, { role: 'user', content: trimmed }],
          session_id: sessionIdRef.current || undefined,
          source,
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && response.body && contentType.includes('application/x-ndjson')) {
        const assistantId = createId();
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          sources: [],
          schoolCandidates: [],
        };
        setMessages([...nextMessages, assistantMessage]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedContent = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as {
              type?: string;
              content?: string;
              reply?: string;
              sources?: ChatSource[];
              schoolCandidates?: SchoolCandidate[];
              model?: string;
              error?: string;
            };

            if (event.type === 'delta' && typeof event.content === 'string') {
              streamedContent += event.content;
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId ? { ...message, content: streamedContent } : message
                )
              );
            }

            if (event.type === 'done') {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: typeof event.reply === 'string' ? event.reply : streamedContent,
                        sources: Array.isArray(event.sources) ? event.sources : [],
                        schoolCandidates: Array.isArray(event.schoolCandidates)
                          ? event.schoolCandidates
                          : [],
                        model: typeof event.model === 'string' ? event.model : undefined,
                      }
                    : message
                )
              );
            }

            if (event.type === 'error') {
              throw new Error(event.error || '回答の取得に失敗しました');
            }
          }
        }
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error || '回答の取得に失敗しました');
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: typeof data.reply === 'string' ? data.reply : '回答を生成できませんでした。',
        sources: Array.isArray(data.sources) ? (data.sources as ChatSource[]) : [],
        schoolCandidates: Array.isArray(data.schoolCandidates)
          ? (data.schoolCandidates as SchoolCandidate[])
          : [],
        model: typeof data.model === 'string' ? data.model : undefined,
      };
      setMessages([...nextMessages, assistantMessage]);
    } catch (err) {
      setMessages(nextMessages);
      setError(err instanceof Error ? err.message : '通信エラーが発生しました');
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {!compact && messages.length <= 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5 sm:mb-3">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-blue-100 bg-white p-3 shadow-inner shadow-blue-50/60 sm:p-4"
      >
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 text-gray-800 ring-1 ring-gray-100'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:mb-2 prose-ul:my-2 prose-li:my-1 prose-strong:text-gray-900">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children }) => (
                          <h2 className="mb-2 mt-4 border-b-2 border-blue-100 pb-1.5 text-[15px] font-bold text-gray-900 first:mt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mb-1.5 mt-3 text-sm font-bold text-blue-900">{children}</h3>
                        ),
                        a: ({ href, children }) => {
                          if (href?.startsWith('#cite-')) {
                            const anchorId = href.slice(1);
                            return (
                              <button
                                type="button"
                                onClick={() => scrollToCitation(anchorId)}
                                className="mx-0.5 inline-flex min-w-[1.4rem] items-center justify-center rounded-md bg-blue-100 px-1 py-0.5 text-[11px] font-bold leading-none text-blue-700 hover:bg-blue-200"
                                title="根拠カードへ移動"
                              >
                                {children}
                              </button>
                            );
                          }
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {linkifyDocRefs(message.content, message.id)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {message.schoolCandidates && message.schoolCandidates.length > 0 && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5">
                    <p className="mb-2 text-xs font-bold text-blue-900">学校候補（口コミベース）</p>
                    <ul className="space-y-1.5">
                      {message.schoolCandidates.map((school) => (
                        <li key={`${message.id}-${school.name}`}>
                          <Link
                            href={school.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                            onClick={() =>
                              trackEvent(GA_EVENTS.consultationAiSourceClick, {
                                source,
                                source_type: 'school_candidate',
                              })
                            }
                          >
                            {school.name}
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-2.5">
                    <p className="mb-2 text-xs font-bold text-gray-600">根拠として参照した情報</p>
                    <ul className="space-y-1.5">
                      {message.sources.map((sourceItem) => {
                        const label = sourceItem.schoolName
                          ? `${sourceItem.title}（${sourceItem.schoolName}）`
                          : sourceItem.title;
                        const citationId = `cite-${message.id}-${sourceItem.ref}`;
                        if (!sourceItem.url) {
                          return (
                            <li
                              key={`${message.id}-${sourceItem.id}`}
                              id={citationId}
                              className="flex items-start gap-2 rounded-md px-1 py-0.5 text-xs text-gray-500"
                            >
                              <span className="inline-flex min-w-[1.4rem] shrink-0 items-center justify-center rounded-md bg-gray-100 px-1 py-0.5 text-[11px] font-bold text-gray-600">
                                [{sourceItem.index}]
                              </span>
                              <span>{label}</span>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={`${message.id}-${sourceItem.id}`}
                            id={citationId}
                            className="flex items-start gap-2 rounded-md px-1 py-0.5 transition-shadow"
                          >
                            <span className="inline-flex min-w-[1.4rem] shrink-0 items-center justify-center rounded-md bg-blue-100 px-1 py-0.5 text-[11px] font-bold text-blue-700">
                              [{sourceItem.index}]
                            </span>
                            <Link
                              href={sourceItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              onClick={() =>
                                trackEvent(GA_EVENTS.consultationAiSourceClick, {
                                  source,
                                  source_type: sourceItem.sourceType,
                                })
                              }
                            >
                              {label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-gray-100">
                回答を作成しています...
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-3 shrink-0">
        <div className="rounded-2xl border border-blue-100 bg-white p-2.5 shadow-[0_10px_30px_-18px_rgba(37,99,235,0.45)] sm:p-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="相談内容を入力してください（例: 東京都で週1通学、保護者サポート重視）"
            className="min-h-[88px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 sm:min-h-[76px]"
            disabled={isLoading}
          />
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="order-2 text-[11px] leading-relaxed text-gray-500 sm:order-1 sm:text-xs">
              公開口コミと公開情報を根拠に回答します。
            </p>
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="order-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none sm:order-2 sm:w-auto sm:min-w-[132px]"
            >
              <span className="whitespace-nowrap">相談を送信</span>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14m-7-7 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
