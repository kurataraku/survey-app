'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  className,
  hover = false,
  clickable = false,
  onClick,
}: CardProps) {
  const baseStyles = 'bg-white rounded-lg shadow-sm border border-gray-200';
  const hoverStyles = hover || clickable ? 'hover:shadow-md hover:border-blue-300 transition-all cursor-pointer' : '';
  
  return (
    <div
      className={cn(baseStyles, hoverStyles, className)}
      onClick={clickable ? onClick : undefined}
    >
      {children}
    </div>
  );
}








