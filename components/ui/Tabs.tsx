'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  /** 全パネルDOM出力時に付与するid（アンカー用） */
  panelId?: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
  /** true のとき全タブの content をDOMに出力し、非表示は hidden で制御（SSR/SEO用） */
  renderAllPanelsInDOM?: boolean;
  /** 外部制御用。指定時はこの値が表示タブになる */
  activeTab?: string;
  /** タブ切り替え時に呼ばれる（外部制御用） */
  onTabChange?: (id: string) => void;
}

export default function Tabs({
  tabs,
  defaultTab,
  className,
  renderAllPanelsInDOM = false,
  activeTab: controlledActiveTab,
  onTabChange,
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id);
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (id: string) => {
    if (!isControlled) setInternalActiveTab(id);
    onTabChange?.(id);
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={cn('w-full', className)}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 rounded-t-2xl">
        <nav className="flex gap-2 p-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full font-medium text-sm transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {renderAllPanelsInDOM ? (
        <div className="mt-6 space-y-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              id={tab.panelId}
              role="tabpanel"
              aria-hidden={activeTab !== tab.id}
              className={cn(activeTab !== tab.id && 'hidden')}
            >
              {tab.content}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6">{activeTabContent}</div>
      )}
    </div>
  );
}










