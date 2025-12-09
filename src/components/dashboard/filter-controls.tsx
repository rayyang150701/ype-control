'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, Plus, Search } from 'lucide-react';

type FilterControlsProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  onExportAll: () => void;
  onAddNewProject: () => void;
};

export function FilterControls({
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  onExportAll,
  onAddNewProject,
}: FilterControlsProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋案號、專案或負責人..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="篩選狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有專案</SelectItem>
            <SelectItem value="overdue">逾期未報</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onAddNewProject} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          新增專案
        </Button>
        <Button onClick={onExportAll}>
          <Download className="mr-2 h-4 w-4" />
          匯出總表
        </Button>
      </div>
    </div>
  );
}
