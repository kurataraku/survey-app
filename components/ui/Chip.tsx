'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function Chip({
  children,
  variant = 'default',
  size = 'md',
  className,
  onClick,
  selected = false,
}: ChipProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';
  
  const variants = {
    default: selected
      ? 'bg-gray-200 text-gray-900'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    primary: selected
      ? 'bg-blue-500 text-white'
      : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    accent: selected
      ? 'bg-rose-400 text-white'
      : 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    success: selected
      ? 'bg-green-500 text-white'
      : 'bg-green-50 text-green-600 hover:bg-green-100',
    outline: selected
      ? 'border-2 border-blue-500 text-blue-500 bg-blue-50'
      : 'border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-500',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </span>
  );
}










