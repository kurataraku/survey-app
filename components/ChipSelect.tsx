'use client';

import { Controller, Control } from 'react-hook-form';

interface ChipSelectProps {
  name: string;
  control: Control<any>;
  options: { label: string; value: string }[];
  error?: string;
  columns?: number; // PCでの列数（デフォルト2-3列）
}

export default function ChipSelect({
  name,
  control,
  options,
  error,
  columns = 2,
}: ChipSelectProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selectedValues = field.value || [];
        
        return (
          <div>
            <div
              className={`grid gap-3 ${
                columns === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const newValues = isSelected
                        ? selectedValues.filter((v: string) => v !== option.value)
                        : [...selectedValues, option.value];
                      field.onChange(newValues);
                    }}
                    className={`px-4 py-3 rounded-lg border transition-all text-left flex items-center justify-between min-h-[56px] ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                    style={{ fontFamily: 'sans-serif' }}
                  >
                    <span className="text-xs leading-relaxed pr-2 flex-1">{option.label}</span>
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-blue-500 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }}
    />
  );
}

