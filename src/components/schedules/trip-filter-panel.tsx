'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { BusinessTrip, TripFilter, TripCategory, WeekInfo, Client, Project } from '@/types';
import { TRIP_CATEGORIES } from '@/types/businessTrip';
import { getYearWeeks } from '@/lib/calendar-helper';

interface TripFilterPanelProps {
  trips: BusinessTrip[];
  clients: Client[];
  projects: Project[];
  currentYear: number;
  filter: TripFilter;
  onFilterChange: (filter: TripFilter) => void;
  onWeekSelect?: (weekInfo: WeekInfo) => void;
}

export function TripFilterPanel({
  trips,
  clients,
  projects,
  currentYear,
  filter,
  onFilterChange,
  onWeekSelect,
}: TripFilterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(filter.searchKeyword || '');

  // 取得所有曾出現過的 TPM 負責人（去重）
  const allTPMs = Array.from(
    new Set(trips.map((t) => t.tpm).filter(Boolean) as string[])
  ).sort();

  // 取得當前年份的所有週次資訊
  const weeks = getYearWeeks(currentYear);

  // 計算已啟用的進階篩選條件數量
  const activeAdvancedCount = [
    filter.customerId,
    filter.projectId,
    filter.category,
    filter.status,
    filter.week,
    filter.tpm,
  ].filter(Boolean).length;

  const hasAnyFilter = !!searchKeyword.trim() || activeAdvancedCount > 0;

  const handleSearchChange = (val: string) => {
    setSearchKeyword(val);
    onFilterChange({
      ...filter,
      searchKeyword: val.trim() || undefined,
    });
  };

  const handleReset = () => {
    setSearchKeyword('');
    onFilterChange({});
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 space-y-2.5 transition-all">
      {/* 主要列：搜尋框 + 進階篩選按鈕 + 清除 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={searchKeyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜尋出差人員 / 主題任務 / 專案名稱 / 地點..."
            className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 進階篩選展開按鈕 */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`h-9 text-xs gap-1.5 shrink-0 transition-colors ${
            showAdvanced || activeAdvancedCount > 0
              ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
              : 'text-slate-600 hover:text-slate-900 border-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>進階篩選</span>
          {activeAdvancedCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeAdvancedCount}
            </span>
          )}
        </Button>

        {/* 一鍵重置按鈕 */}
        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-9 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 shrink-0"
            title="清除所有搜尋與篩選條件"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">重設</span>
          </Button>
        )}
      </div>

      {/* 進階篩選抽屜 */}
      {showAdvanced && (
        <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* 客戶篩選 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">客戶單位</label>
            <select
              value={filter.customerId || ''}
              onChange={(e) => onFilterChange({ ...filter, customerId: e.target.value || undefined })}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">全部客戶</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 專案篩選 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">所屬專案</label>
            <select
              value={filter.projectId || ''}
              onChange={(e) => onFilterChange({ ...filter, projectId: e.target.value || undefined })}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden truncate"
            >
              <option value="">全部專案</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 出差類別 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">行程類別</label>
            <select
              value={filter.category || ''}
              onChange={(e) => onFilterChange({ ...filter, category: (e.target.value as TripCategory) || undefined })}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">全部類別</option>
              {TRIP_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* 確認狀態 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">確認狀態</label>
            <select
              value={filter.status || ''}
              onChange={(e) => onFilterChange({ ...filter, status: (e.target.value as any) || undefined })}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">全部狀態</option>
              <option value="confirmed">已確認</option>
              <option value="pending">待確認</option>
            </select>
          </div>

          {/* 週別篩選 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">快速週別 (WK)</label>
            <select
              value={filter.week || ''}
              onChange={(e) => {
                const w = e.target.value ? Number(e.target.value) : undefined;
                onFilterChange({ ...filter, week: w, year: w ? currentYear : undefined });
                if (w && onWeekSelect) {
                  const targetWeek = weeks.find((item) => item.weekNumber === w);
                  if (targetWeek) onWeekSelect(targetWeek);
                }
              }}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">不限週別</option>
              {weeks.map((w) => (
                <option key={w.weekNumber} value={w.weekNumber}>
                  {w.label} ({w.startDate.getMonth() + 1}/{w.startDate.getDate()}~{w.endDate.getMonth() + 1}/{w.endDate.getDate()})
                </option>
              ))}
            </select>
          </div>

          {/* TPM 篩選 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">TPM 窗口</label>
            <select
              value={filter.tpm || ''}
              onChange={(e) => onFilterChange({ ...filter, tpm: e.target.value || undefined })}
              className="w-full h-8 px-2 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">全部 TPM</option>
              {allTPMs.map((tpm) => (
                <option key={tpm} value={tpm}>
                  {tpm}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
