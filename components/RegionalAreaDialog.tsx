'use client';

import { useEffect, useRef } from 'react';
import type { FinderAreaGroup, FinderAreaOption } from '@/lib/schools/regionalLanding';

interface RegionalAreaDialogProps {
  id: string;
  open: boolean;
  title: string;
  note?: string;
  groups: FinderAreaGroup[];
  selectedId: string;
  countFor: (option: FinderAreaOption) => number;
  onSelect: (option: FinderAreaOption) => void;
  onClose: () => void;
}

/**
 * 地域をすべて並べて選ぶダイアログ。スマホでは画面下から出るシート、PCでは中央に出す。
 * 中身は開いたときだけ描画し、初期HTMLを増やさない。
 */
export default function RegionalAreaDialog({
  id,
  open,
  title,
  note,
  groups,
  selectedId,
  countFor,
  onSelect,
  onClose,
}: RegionalAreaDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `${id}-title`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-full overflow-hidden rounded-t-2xl border-0 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-950/50 sm:m-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-2xl"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 py-2 pr-2 pl-4">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-2xl leading-none text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-4 pt-3 pb-6">
            {note && <p className="mb-3 text-xs leading-relaxed text-gray-500">{note}</p>}
            {groups.map((group) => (
              <section key={group.label ?? 'all'} className="mb-5 last:mb-0">
                {group.label && <h3 className="mb-2 text-sm font-bold text-gray-800">{group.label}</h3>}
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.options.map((option) => {
                    const count = countFor(option);
                    const active = option.id === selectedId;
                    const disabled = count === 0 && !active;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          disabled={disabled}
                          onClick={() => onSelect(option)}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                            active
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-blue-200 bg-white text-gray-800 hover:border-blue-500'
                          } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                          <span>{option.label}</span>
                          <span className="shrink-0 font-normal">{count}校</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
