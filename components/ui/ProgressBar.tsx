'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'primary',
  size = 'md',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const variants = {
    primary: 'bg-blue-600',
    accent: 'bg-rose-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };
  
  const sizes = {
    sm: 'h-1',
    md: 'h-1.5',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-700">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium text-gray-900">
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('rounded-full transition-all duration-300', variants[variant], sizes[size])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}










