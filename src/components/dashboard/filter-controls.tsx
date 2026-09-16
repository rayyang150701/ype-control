'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, Plus, Search, LayoutGrid, List, Trash2, PauseCircle, PlayCircle, Users, Lock, Unlock, Calendar, ArrowDownToLine, Hourglass } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { User, WeeklySnapshotItem } from '@/types';

type FilterControlsProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  ownerFilter: string;
  setOwnerFilter: (filter: string) => void;
  owners: User[];
  onExportAll: () => void;
  onAddNewProject: () => void;
  onDeleteProject: () => void;
  onOnHoldProject: () => void;
  onReusmeProject: () => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  isAdmin: boolean;
  isEditor?: boolean;
  onAdminToggle?: () => void;
  // 每週管制表快照與匯出
  weeklySnapshots?: WeeklySnapshotItem[];
  onExportWeek?: (weekKey: string) => void;
  onSaveCurrentWeekSnapshot?: () => void;
  isSnapshotting?: boolean;
  currentWeekLabel?: string;
};

export function FilterControls({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,
  owners,
  onExportAll,
  onAddNewProject,
  onDeleteProject,
  onOnHoldProject,
  onReusmeProject,
  viewMode,
  setViewMode,
  isAdmin,
  isEditor,
  onAdminToggle,
  weeklySnapshots = [],
  onExportWeek,
  onSaveCurrentWeekSnapshot,
  isSnapshotting = false,
  currentWeekLabel,
}: FilterControlsProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
        <div className="relative w-full sm:max-w-xs" data-tour="search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案號、名稱、TPM窗口..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div data-tour="filter-status">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="篩選狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                <SelectItem value="in_progress">進行中</SelectItem>
                <SelectItem value="on-hold">暫緩中</SelectItem>
                <SelectItem value="overdue">本週未更新</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div data-tour="filter-owner">
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="負責人" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有負責人</SelectItem>
                {owners.map(owner => (
                  <SelectItem key={owner.uid} value={owner.uid}>
                    {owner.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 每週管制表下拉選擇與轉存 (紅框標註位置) */}
          <div className="flex items-center gap-1.5 flex-wrap" data-tour="weekly-report">
            <Select
              value=""
              onValueChange={(weekKey) => {
                if (weekKey && onExportWeek) {
                  onExportWeek(weekKey);
                }
              }}
              disabled={!isEditor}
            >
              <SelectTrigger
                className={`w-[195px] text-xs h-10 ${
                  !isEditor ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'bg-white hover:border-slate-400'
                }`}
                title={!isEditor ? '需編輯者以上權限才能下載每週管制表' : '選定週次直接匯出 Excel'}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="truncate">選擇每週管制表 (匯出)</span>
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border-b">
                  選定週次直接匯出 Excel 格式：
                </div>
                {weeklySnapshots && weeklySnapshots.length > 0 ? (
                  weeklySnapshots.map((w) => (
                    <SelectItem key={w.key} value={w.key} className="text-xs py-1.5 cursor-pointer">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="font-mono">{w.label}</span>
                        {w.hasSnapshot && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            已轉存
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled className="text-xs text-muted-foreground">
                    暫無可用週次
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* 轉出本週資料按鈕 (僅編輯者以上可見) */}
            {isEditor && onSaveCurrentWeekSnapshot && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSaveCurrentWeekSnapshot}
                disabled={isSnapshotting}
                className="h-10 text-xs px-2.5 gap-1.5 border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 font-medium shadow-2xs"
                title={`將目前全專案最新進度轉出儲存至 ${currentWeekLabel || '本週'} (同週自動覆蓋)`}
              >
                {isSnapshotting ? (
                  <Hourglass className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                ) : (
                  <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-700" />
                )}
                <span>轉出本週</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={viewMode} onValueChange={(value: 'grid' | 'table') => value && setViewMode(value)}>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        
        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        {isAdmin && (
          <>
            <Button onClick={onAddNewProject} variant="outline" data-tour="add-new-project">
              <Plus className="mr-2 h-4 w-4" />
              新增
            </Button>
            <Button onClick={onOnHoldProject} variant="outline" data-tour="on-hold-project">
                <PauseCircle className="mr-2 h-4 w-4" />
                暫緩
            </Button>
            <Button onClick={onReusmeProject} variant="outline" data-tour="resume-project">
                <PlayCircle className="mr-2 h-4 w-4" />
                恢復
            </Button>
            <Button onClick={onDeleteProject} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                刪除
            </Button>
          </>
        )}

        <Button onClick={onExportAll} data-tour="export-all" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="mr-2 h-4 w-4" />
          匯出總表
        </Button>
      </div>
    </div>
  );
}
