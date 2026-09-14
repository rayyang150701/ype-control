'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Check,
  CheckCircle2,
  Hourglass,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  Search,
  ExternalLink,
  FolderGit2,
  ArrowUpDown,
  Clock,
  Building2,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import type { FullProject, ProjectActionItem, User, Client } from '@/types';

interface TaskCentricViewProps {
  items: ProjectActionItem[];
  projects: FullProject[];
  users?: User[];
  clients?: Client[];
  isAdmin: boolean;
  onEditItem: (item: ProjectActionItem) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onToggleComplete: (item: ProjectActionItem) => Promise<void>;
  onAddNewItem: (defaultProjectId?: string) => void;
  onSwitchToProjectView: (projectId: string) => void;
  uniqueWaitingOns: string[];
}

export function TaskCentricView({
  items,
  projects,
  users = [],
  clients = [],
  isAdmin,
  onEditItem,
  onDeleteItem,
  onToggleComplete,
  onAddNewItem,
  onSwitchToProjectView,
  uniqueWaitingOns,
}: TaskCentricViewProps) {
  // 建立專案快速查找 Map (以 projectId 為 key)
  const projectMap = useMemo(() => {
    const map = new Map<string, FullProject>();
    projects.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [projects]);

  // 快捷狀態分頁：全部、卡關等候、逾期/即將到期、處理中、已完成
  const [activeTab, setActiveTab] = useState<'all' | 'blocked' | 'overdue' | 'active' | 'completed'>('all');

  // 細部篩選條件
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedWaitingOn, setSelectedWaitingOn] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'dueDate' | 'projectCase' | 'statusPriority'>('newest');

  // 計算各狀態分頁項目數量
  const tabCounts = useMemo(() => {
    const today = new Date();
    let blockedCount = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let completedCount = 0;

    items.forEach((item) => {
      if (item.status === 'completed') {
        completedCount++;
      } else {
        activeCount++;
        if (item.status === 'blocked') blockedCount++;
        if (item.dueDate) {
          const due = new Date(item.dueDate);
          const diff = differenceInCalendarDays(today, due);
          if (diff > 0 || (diff >= -3 && diff <= 0)) {
            overdueCount++;
          }
        }
      }
    });

    return {
      all: items.length,
      blocked: blockedCount,
      overdue: overdueCount,
      active: activeCount,
      completed: completedCount,
    };
  }, [items]);

  // 自然序號比較函數 (1, 2, ... 10, ... 55)
  const compareCaseNumbers = (a?: string, b?: string, asc: boolean = true) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    const matchA = a.match(/^(\d+)/);
    const matchB = b.match(/^(\d+)/);
    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const numB = parseInt(matchB[1], 10);
      if (numA !== numB) return asc ? numA - numB : numB - numA;
    }
    return asc
      ? a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      : b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
  };

  // 篩選與排序後的待辦項目列表
  const filteredAndSortedItems = useMemo(() => {
    const today = new Date();
    const queryLower = searchQuery.trim().toLowerCase();

    const filtered = items.filter((item) => {
      // 1. 快捷分頁標籤篩選
      if (activeTab === 'blocked' && item.status !== 'blocked') return false;
      if (activeTab === 'completed' && item.status !== 'completed') return false;
      if (activeTab === 'active' && item.status === 'completed') return false;
      if (activeTab === 'overdue') {
        if (item.status === 'completed' || !item.dueDate) return false;
        const diff = differenceInCalendarDays(today, new Date(item.dueDate));
        if (diff <= 0 && (diff < -3 || diff > 0)) return false;
      }

      // 2. 關鍵字搜尋
      if (queryLower) {
        const proj = projectMap.get(item.projectId);
        const matchesQuery =
          item.title.toLowerCase().includes(queryLower) ||
          (item.notes && item.notes.toLowerCase().includes(queryLower)) ||
          (item.waitingOn && item.waitingOn.toLowerCase().includes(queryLower)) ||
          (item.owner && item.owner.toLowerCase().includes(queryLower)) ||
          (item.projectName && item.projectName.toLowerCase().includes(queryLower)) ||
          (item.projectCaseNumber && item.projectCaseNumber.toLowerCase().includes(queryLower)) ||
          (proj && proj.name.toLowerCase().includes(queryLower)) ||
          (proj?.caseNumber && proj.caseNumber.toLowerCase().includes(queryLower)) ||
          (proj?.clientName && proj.clientName.toLowerCase().includes(queryLower));

        if (!matchesQuery) return false;
      }

      // 3. 下拉欄位篩選
      if (selectedProjectId !== 'all' && item.projectId !== selectedProjectId) return false;
      if (selectedWaitingOn !== 'all' && item.waitingOn !== selectedWaitingOn) return false;

      return true;
    });

    // 4. 排序
    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        // 最新建立在前 (預設)
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      }

      if (sortBy === 'dueDate') {
        // 預計完成日 (無日期在最後，近的在前)
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      if (sortBy === 'projectCase') {
        const projA = projectMap.get(a.projectId);
        const projB = projectMap.get(b.projectId);
        return compareCaseNumbers(projA?.caseNumber || a.projectCaseNumber, projB?.caseNumber || b.projectCaseNumber, true);
      }

      if (sortBy === 'statusPriority') {
        const priorityOrder: Record<string, number> = {
          blocked: 1,
          in_progress: 2,
          pending: 3,
          completed: 4,
        };
        const rankA = priorityOrder[a.status] || 99;
        const rankB = priorityOrder[b.status] || 99;
        return rankA - rankB;
      }

      return 0;
    });
  }, [
    items,
    activeTab,
    searchQuery,
    selectedProjectId,
    selectedWaitingOn,
    sortBy,
    projectMap,
  ]);

  const hasActiveFilters =
    searchQuery ||
    selectedProjectId !== 'all' ||
    selectedWaitingOn !== 'all' ||
    activeTab !== 'all';

  const handleResetFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setSelectedProjectId('all');
    setSelectedWaitingOn('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-3.5">
      {/* 待辦事項快捷狀態頁籤列 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>全部待辦</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {tabCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('blocked')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'blocked'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>🚨 卡關等候中</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'blocked' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {tabCounts.blocked}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'overdue'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>⚠️ 逾期 / 即將到期</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'overdue' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {tabCounts.overdue}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>🔄 處理中 / 待辦</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'active' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {tabCounts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>✅ 已完成</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {tabCounts.completed}
            </span>
          </button>
        </div>

        {/* 快速新增按鈕 */}
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => onAddNewItem()}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>新增待辦事項</span>
          </Button>
        )}
      </div>

      {/* 搜尋與篩選列 */}
      <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* 搜尋框 */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜尋議題、專案名稱、案號、等候窗口..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>

          {/* 所屬專案下拉篩選 */}
          {/* 所屬專案下拉 */}
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px] h-9 text-xs bg-white">
              <SelectValue placeholder="所屬專案" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">全部所屬專案</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.caseNumber ? `[${p.caseNumber}] ` : ''}
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 篩選待處理者 (等候對象) 下拉 */}
          <Select value={selectedWaitingOn} onValueChange={setSelectedWaitingOn}>
            <SelectTrigger className={`w-[165px] h-9 text-xs bg-white transition-colors ${selectedWaitingOn !== 'all' ? 'border-rose-400 bg-rose-50/50 text-rose-950 font-bold' : ''}`}>
              <Clock className="h-3 w-3 mr-1 text-rose-500 shrink-0" />
              <SelectValue placeholder="篩選待處理者" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">全部待處理者 (等候對象)</SelectItem>
              {uniqueWaitingOns.map((party) => {
                const count = items.filter((i) => i.waitingOn === party).length;
                return (
                  <SelectItem key={party} value={party} className="text-xs">
                    <span className="font-semibold text-rose-700">等候: {party}</span>
                    <span className="ml-1.5 text-[11px] text-muted-foreground">({count} 項)</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* 排序下拉 */}
          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="w-[145px] h-9 text-xs bg-white">
              <ArrowUpDown className="h-3 w-3 mr-1 text-slate-500" />
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">建立時間 (最新)</SelectItem>
              <SelectItem value="dueDate">預計到期 (急迫優先)</SelectItem>
              <SelectItem value="projectCase">依專案案號排序</SelectItem>
              <SelectItem value="statusPriority">卡關中優先</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>重置</span>
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground font-medium shrink-0 text-right">
          共 <span className="text-slate-900 font-bold">{filteredAndSortedItems.length}</span> 項待辦
        </div>
      </div>

      {/* 快捷等候對象標籤列 */}
      {uniqueWaitingOns.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs px-1">
          <span className="text-muted-foreground font-medium mr-1">🔍 快速過濾等候:</span>
          <button
            type="button"
            onClick={() => setSelectedWaitingOn('all')}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors cursor-pointer ${
              selectedWaitingOn === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            全部
          </button>
          {uniqueWaitingOns.map((party) => (
            <button
              key={party}
              type="button"
              onClick={() => setSelectedWaitingOn(selectedWaitingOn === party ? 'all' : party)}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                selectedWaitingOn === party
                  ? 'bg-rose-600 text-white border-rose-600 font-medium'
                  : 'bg-rose-50/70 text-rose-700 hover:bg-rose-100 border-rose-200'
              }`}
            >
              <span>等候：{party}</span>
            </button>
          ))}
        </div>
      )}

      {/* 待辦事項清單主體：簡約兩行呈現 */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-white shadow-2xs">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h3 className="text-base font-semibold text-slate-700">查無符合條件的待辦工作事項</h3>
          <p className="text-xs text-muted-foreground mt-1">
            可嘗試切換上方狀態標籤或清除篩選條件，亦可點選右上角「新增待辦事項」直接建立。
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-4 text-xs cursor-pointer"
            >
              清除所有篩選條件
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedItems.map((item) => {
            const isDone = item.status === 'completed';
            const proj = projectMap.get(item.projectId);
            const projName = proj?.name || item.projectName || '未指定專案';
            const projCase = proj?.caseNumber || item.projectCaseNumber;
            const projClient = proj?.clientName || '燁輝';

            const today = new Date();
            const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
            const diffDays = dueDateObj ? differenceInCalendarDays(today, dueDateObj) : 0;
            const isOverdue = !isDone && dueDateObj && diffDays > 0;

            return (
              <div
                key={item.id}
                id={`task-item-${item.id}`}
                className={`px-3.5 py-2.5 rounded-lg border transition-all ${
                  isDone
                    ? 'bg-slate-50/70 border-slate-200/80 opacity-75'
                    : item.status === 'blocked'
                    ? 'bg-rose-50/25 border-rose-200 hover:border-rose-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* 一鍵切換完成 (Checkbox) */}
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => onToggleComplete(item)}
                      className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-emerald-600 bg-white'
                      }`}
                      title={isDone ? '標記為未完成 (重新開啟)' : '標記為已完成'}
                    >
                      {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                    </button>
                  ) : (
                    <div className="mt-1 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Hourglass className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  )}

                  {/* 核心內容區 (精簡兩行) */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* 第一行：(議題、等候誰、客戶、專案名) */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {/* 議題 (標題) */}
                      <span
                        className={`text-sm font-bold text-slate-900 ${
                          isDone ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {item.title}
                      </span>

                      {/* 等候誰 */}
                      {item.waitingOn ? (
                        <Badge
                          variant={isDone ? 'outline' : 'destructive'}
                          className={
                            isDone
                              ? 'font-normal text-xs px-2 py-0.5 bg-slate-100 text-slate-500 border-slate-200 shadow-none shrink-0'
                              : 'font-semibold text-xs px-2 py-0.5 bg-rose-600 text-white shadow-xs gap-1 shrink-0'
                          }
                        >
                          {!isDone && <AlertCircle className="h-3 w-3" />}
                          等候：{item.waitingOn}
                        </Badge>
                      ) : null}

                      {/* 客戶 */}
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-medium shrink-0">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {projClient}
                      </span>

                      {/* 專案名 */}
                      <button
                        type="button"
                        onClick={() => onSwitchToProjectView(item.projectId)}
                        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline font-semibold bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200/70 transition-colors cursor-pointer shrink-0 group"
                        title="點選切換至專案檢視"
                      >
                        <FolderGit2 className="h-3 w-3 text-blue-500 group-hover:text-blue-700" />
                        <span className="truncate max-w-[240px] sm:max-w-[400px]">
                          {projCase ? `[${projCase}] ` : ''}{projName}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                      </button>
                    </div>

                    {/* 第二行：工作事項內容 + 預計完成日 (延誤、超前) + 操作 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                      {/* 工作事項內容 */}
                      <div className="text-xs text-slate-600 leading-relaxed flex-1 min-w-0 pr-2">
                        {item.notes ? (
                          <span>{item.notes}</span>
                        ) : (
                          <span className="text-slate-400 italic">無補充事項內容</span>
                        )}
                        {item.lessonLearnt && (
                          <span className="ml-2 inline-flex items-center text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                            💡 檢討: {item.lessonLearnt}
                          </span>
                        )}
                      </div>

                      {/* 預計完成日 (延誤、超前) + 操作按鈕 */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        {item.dueDate ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              預計: {item.dueDate}
                            </span>

                            {isDone ? (
                              <span className="text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✅ 已完成
                              </span>
                            ) : isOverdue ? (
                              <span className="text-rose-700 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                🚨 延誤 {diffDays} 天
                              </span>
                            ) : diffDays === 0 ? (
                              <span className="text-amber-800 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                ⚠️ 今日到期
                              </span>
                            ) : (
                              <span className="text-blue-700 font-semibold text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                ⏳ 剩餘 {Math.abs(diffDays)} 天
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未設預計日</span>
                        )}

                        {/* 編輯 / 刪除 按鈕 */}
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 ml-1 border-l pl-1.5 border-slate-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditItem(item)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 cursor-pointer"
                              title="編輯待辦事項"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteItem(item.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="刪除事項"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
