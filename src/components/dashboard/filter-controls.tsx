
'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, Plus, Search, LayoutGrid, List, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type FilterControlsProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  onExportAll: () => void;
  onAddNewProject: () => void;
  onDeleteProject: () => void;
  onOnHoldProject: () => void;
  onReusmeProject: () => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
};

export function FilterControls({
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  onExportAll,
  onAddNewProject,
  onDeleteProject,
  onOnHoldProject,
  onReusmeProject,
  viewMode,
  setViewMode,
}: FilterControlsProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋案號、專案名稱、TPM管理室窗口..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="篩選狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有專案</SelectItem>
            <SelectItem value="in_progress">所有專案 (排除已完成)</SelectItem>
            <SelectItem value="on-hold">暫緩中</SelectItem>
            <SelectItem value="overdue">逾期未報</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup type="single" value={viewMode} onValueChange={(value: 'grid' | 'table') => value && setViewMode(value)}>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        
        <Button onClick={onAddNewProject} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          新增專案
        </Button>
        <Button onClick={onOnHoldProject} variant="outline">
            <PauseCircle className="mr-2 h-4 w-4" />
            專案暫緩
        </Button>
        <Button onClick={onReusmeProject} variant="outline">
            <PlayCircle className="mr-2 h-4 w-4" />
            恢復專案
        </Button>
        <Button onClick={onDeleteProject} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            刪除專案
        </Button>
        <Button onClick={onExportAll}>
          <Download className="mr-2 h-4 w-4" />
          匯出總表
        </Button>
      </div>
    </div>
  );
}
