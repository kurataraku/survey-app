'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string[];
  allowMultiple?: boolean;
  className?: string;
}

export default function Accordion({
  items,
  defaultOpen = [],
  allowMultiple = false,
  className,
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpen);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      } else {
        return prev.includes(id) ? [] : [id];
      }
    });
  };

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id);
        return (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full px-4 py-3 flex justify-between items-center text-left bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{item.title}</span>
              <svg
                className={cn(
                  'w-5 h-5 text-gray-500 transition-transform',
                  isOpen && 'transform rotate-180'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {isOpen && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}









