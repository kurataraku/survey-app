'use client';

import { useState } from 'react';
import { prefectures } from '@/lib/prefectures';

export interface ReviewFilters {
  role?: string; // '本人' | '保護者'
  graduation_path?: string;
  reason_for_choosing?: string[]; // 複数選択（OR条件）
  enrollment_type?: string;
  attendance_frequency?: string;
  campus_prefecture?: string;
}

interface ReviewFiltersProps {
  filters: ReviewFilters;
  onFiltersChange: (filters: ReviewFilters) => void;
  totalCount: number;
  filteredCount: number;
  sort?: string;
  onSortChange?: (sort: string) => void;
}

const reasonForChoosingOptions = [
  { label: '心の不調', value: '心の不調のため' },
  { label: '人間関係', value: '先生・友人などの人間関係に悩んだため' },
  { label: '学習スタイル', value: '全日制の学習スタイルが合わないため' },
  { label: '心や体の状態／発達障害・知的障害など', value: '心や体の状態／発達障害・知的障害などのため' },
  { label: '働きながら', value: '働きながら学びたいため' },
  { label: 'スポーツ・芸術・芸能', value: 'スポーツ/芸術/芸能活動との両立のため' },
  { label: '学費', value: '学費をおさえるため' },
  { label: '学びなおし', value: '学びなおしのため' },
];

const enrollmentTypeOptions = [
  { label: '新入学', value: '新入学（中学卒業後）' },
  { label: '転入学', value: '転入学（他校から転校）' },
  { label: '編入学', value: '編入学（中退後に入り直し）' },
];

const attendanceFrequencyOptions = [
  { label: '週5', value: '週5' },
  { label: '週3〜4', value: '週3〜4' },
  { label: '週1〜2', value: '週1〜2' },
  { label: '月1〜数回', value: '月1〜数回' },
  { label: 'ほぼオンライン・自宅', value: 'ほぼオンライン/自宅' },
];

const graduationPathOptions = [
  { label: '大学進学', value: '大学進学' },
  { label: '専門学校進学', value: '専門学校進学' },
  { label: '短期大学進学', value: '短期大学進学' },
  { label: '就職', value: '就職' },
  { label: '休養', value: '休養' },
];

// 選択中条件のラベルを取得
const getFilterLabel = (key: string, value: string | string[]): string => {
  if (Array.isArray(value)) {
    return value.map((v) => {
      const option = reasonForChoosingOptions.find((o) => o.value === v);
      return option?.label || v;
    }).join('、');
  }
  
  switch (key) {
    case 'role':
      return value === '本人' ? '本人' : '保護者';
    case 'attendance_frequency':
      return attendanceFrequencyOptions.find((o) => o.value === value)?.label || value;
    case 'enrollment_type':
      return enrollmentTypeOptions.find((o) => o.value === value)?.label || value;
    case 'graduation_path':
      return graduationPathOptions.find((o) => o.value === value)?.label || value;
    case 'campus_prefecture':
      return value;
    default:
      return String(value);
  }
};

export default function ReviewFilters({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  sort = 'newest',
  onSortChange,
}: ReviewFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Object.keys(filters).some(
    (key) => {
      const value = filters[key as keyof ReviewFilters];
      return value !== undefined && value !== null && 
        (Array.isArray(value) ? value.length > 0 : value !== '');
    }
  );

  // 選択中条件のリストを生成
  const activeFilterChips: Array<{ key: string; label: string; value: string | string[] }> = [];
  if (filters.role) {
    activeFilterChips.push({ key: 'role', label: getFilterLabel('role', filters.role), value: filters.role });
  }
  if (filters.attendance_frequency) {
    activeFilterChips.push({ key: 'attendance_frequency', label: getFilterLabel('attendance_frequency', filters.attendance_frequency), value: filters.attendance_frequency });
  }
  if (filters.campus_prefecture) {
    activeFilterChips.push({ key: 'campus_prefecture', label: getFilterLabel('campus_prefecture', filters.campus_prefecture), value: filters.campus_prefecture });
  }
  if (filters.reason_for_choosing && filters.reason_for_choosing.length > 0) {
    filters.reason_for_choosing.forEach((reason) => {
      activeFilterChips.push({ key: 'reason_for_choosing', label: getFilterLabel('reason_for_choosing', reason), value: reason });
    });
  }
  if (filters.enrollment_type) {
    activeFilterChips.push({ key: 'enrollment_type', label: getFilterLabel('enrollment_type', filters.enrollment_type), value: filters.enrollment_type });
  }
  if (filters.graduation_path) {
    activeFilterChips.push({ key: 'graduation_path', label: getFilterLabel('graduation_path', filters.graduation_path), value: filters.graduation_path });
  }

  const handleReset = () => {
    onFiltersChange({});
  };

  const handleRemoveFilter = (key: string, valueToRemove?: string) => {
    if (key === 'reason_for_choosing' && valueToRemove) {
      const current = filters.reason_for_choosing || [];
      const newReasons = current.filter((r) => r !== valueToRemove);
      onFiltersChange({
        ...filters,
        reason_for_choosing: newReasons.length > 0 ? newReasons : undefined,
      });
    } else {
      onFiltersChange({
        ...filters,
        [key]: undefined,
      });
    }
  };

  const handleRoleChange = (value: string) => {
    onFiltersChange({
      ...filters,
      role: value === filters.role ? undefined : value,
    });
  };

  const handleGraduationPathChange = (value: string) => {
    onFiltersChange({
      ...filters,
      graduation_path: value === filters.graduation_path ? undefined : value,
    });
  };

  const handleEnrollmentTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      enrollment_type: value === filters.enrollment_type ? undefined : value,
    });
  };

  const handleAttendanceFrequencyChange = (value: string) => {
    onFiltersChange({
      ...filters,
      attendance_frequency: value === filters.attendance_frequency ? undefined : value,
    });
  };

  const handleCampusPrefectureChange = (value: string) => {
    onFiltersChange({
      ...filters,
      campus_prefecture: value === filters.campus_prefecture ? undefined : value,
    });
  };

  const handleReasonForChoosingToggle = (value: string) => {
    const current = filters.reason_for_choosing || [];
    const newReasons = current.includes(value)
      ? current.filter((r) => r !== value)
      : [...current, value];
    
    onFiltersChange({
      ...filters,
      reason_for_choosing: newReasons.length > 0 ? newReasons : undefined,
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-3">
      {/* 見出し行 */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">自分の立場に近い口コミを探す</h3>
          {hasActiveFilters && (
            <span className="text-xs text-gray-600">
              該当：<span className="font-bold text-blue-600">{filteredCount}</span>件
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSortChange && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600">並び替え</label>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="newest">新着順</option>
                <option value="oldest">古い順</option>
                <option value="rating_desc">評価が高い順</option>
                <option value="rating_asc">評価が低い順</option>
              </select>
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            {isOpen ? '条件を閉じる' : '条件を設定して絞り込む'}
          </button>
        </div>
      </div>

      {/* 選択中条件のチップ表示 */}
      {hasActiveFilters && (
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-600">選択中：</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {activeFilterChips.map((chip, index) => (
                <button
                  key={`${chip.key}-${index}`}
                  onClick={() => handleRemoveFilter(chip.key, Array.isArray(chip.value) ? chip.value[0] : chip.value)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium hover:bg-blue-200 transition-colors"
                >
                  <span>{chip.label}</span>
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ))}
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
            >
              クリア
            </button>
          </div>
        </div>
      )}

      {/* フィルタ内容（折りたたみ - 1段階） */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* 通学頻度 */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              主な通学頻度
            </label>
            <div className="flex flex-wrap gap-1.5">
              {attendanceFrequencyOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAttendanceFrequencyChange(option.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    filters.attendance_frequency === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 都道府県 */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              主に通っていたキャンパスの都道府県
            </label>
            <select
              value={filters.campus_prefecture || ''}
              onChange={(e) => handleCampusPrefectureChange(e.target.value)}
              className="w-full sm:w-64 px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">選択してください</option>
              {prefectures.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>

          {/* 通信制を選んだ理由 */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              通信制を選んだ理由（複数選択可）
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {reasonForChoosingOptions.map((option) => {
                const isChecked = filters.reason_for_choosing?.includes(option.value) || false;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleReasonForChoosingToggle(option.value)}
                    className={`px-2 py-1.5 rounded text-xs font-medium text-left transition-all ${
                      isChecked
                        ? 'bg-blue-600 text-white border-2 border-blue-600'
                        : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 入学タイミング */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              入学タイミング
            </label>
            <div className="flex flex-wrap gap-1.5">
              {enrollmentTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleEnrollmentTypeChange(option.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    filters.enrollment_type === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 卒業後の進路 */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              卒業後の進路
            </label>
            <div className="flex flex-wrap gap-1.5">
              {graduationPathOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleGraduationPathChange(option.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    filters.graduation_path === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 投稿者の立場 */}
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <label className="block text-xs font-semibold text-gray-900 mb-2">
              投稿者の立場
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleRoleChange('本人')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  filters.role === '本人'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                本人
              </button>
              <button
                onClick={() => handleRoleChange('保護者')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  filters.role === '保護者'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                保護者
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
