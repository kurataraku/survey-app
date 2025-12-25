'use client';

import { Controller, Control } from 'react-hook-form';

interface TextAreaWithCounterProps {
  name: string;
  control: Control<any>;
  placeholder?: string;
  minLength: number;
  currentLength: number;
  error?: string;
}

export default function TextAreaWithCounter({
  name,
  control,
  placeholder,
  minLength,
  currentLength,
  error,
}: TextAreaWithCounterProps) {
  const remaining = minLength - currentLength;
  const isInsufficient = currentLength < minLength;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div>
          <textarea
            {...field}
            rows={5}
            placeholder={placeholder}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2"
            style={{
              borderRadius: 'var(--ce-radius-control)',
              borderColor: error ? 'var(--ce-warning)' : 'var(--ce-border)',
              fontFamily: 'var(--ce-font-body)'
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = 'var(--ce-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 191, 99, 0.2)';
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = 'var(--ce-border)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span style={{ 
                fontFamily: 'var(--ce-font-body)',
                color: isInsufficient ? 'var(--ce-warning)' : 'var(--ce-muted)'
              }}>
                {currentLength}/{minLength}文字
              </span>
              {isInsufficient && (
                <span className="font-medium" style={{ 
                  fontFamily: 'var(--ce-font-body)',
                  color: 'var(--ce-warning)'
                }}>
                  あと{remaining}文字
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    />
  );
}

