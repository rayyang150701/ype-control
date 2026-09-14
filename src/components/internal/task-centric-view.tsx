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
  UserCheck,
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
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [selectedWaitingOn, setSelectedWaitingOn] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'dueDate' | 'projectCase' | 'statusPriority'>('newest');

  // 提取所有不重複的責任歸屬選項
  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.owner && item.owner.trim()) {
        set.add(item.owner.trim());
      }
    });
    return Array.from(set);
  }, [items]);

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

  // 階段配色 Badge
  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case '評估階段':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">評估階段</Badge>;
      case '報價/設計':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">報價/設計</Badge>;
      case '簽呈核決':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">簽呈核決</Badge>;
      case '開發/施工':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">開發/施工</Badge>;
      case '驗證測試':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">驗證測試</Badge>;
      case '驗收結案':
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">驗收結案</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{phase}</Badge>;
    }
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
      if (selectedOwner !== 'all' && item.owner !== selectedOwner) return false;
      if (selectedWaitingOn !== 'all' && item.waitingOn !== selectedWaitingOn) return false;
      if (selectedPhase !== 'all' && item.phase !== selectedPhase) return false;

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
    selectedOwner,
    selectedWaitingOn,
    selectedPhase,
    sortBy,
    projectMap,
  ]);

  const hasActiveFilters =
    searchQuery ||
    selectedProjectId !== 'all' ||
    selectedOwner !== 'all' ||
    selectedWaitingOn !== 'all' ||
    selectedPhase !== 'all' ||
    activeTab !== 'all';

  const handleResetFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setSelectedProjectId('all');
    setSelectedOwner('all');
    setSelectedWaitingOn('all');
    setSelectedPhase('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-4">
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

      {/* 搜尋與多重篩選列 */}
      <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* 搜尋框 */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜尋待辦、專案名稱、案號、窗口..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>

          {/* 所屬專案下拉篩選 */}
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-white">
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

          {/* 責任歸屬下拉 */}
          <Select value={selectedOwner} onValueChange={setSelectedOwner}>
            <SelectTrigger className="w-[125px] h-9 text-xs bg-white">
              <SelectValue placeholder="責任歸屬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部責任歸屬</SelectItem>
              {uniqueOwners.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 專案階段下拉 */}
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[115px] h-9 text-xs bg-white">
              <SelectValue placeholder="階段篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部階段</SelectItem>
              <SelectItem value="評估階段">評估階段</SelectItem>
              <SelectItem value="報價/設計">報價/設計</SelectItem>
              <SelectItem value="簽呈核決">簽呈核決</SelectItem>
              <SelectItem value="開發/施工">開發/施工</SelectItem>
              <SelectItem value="驗證測試">驗證測試</SelectItem>
              <SelectItem value="驗收結案">驗收結案</SelectItem>
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
          顯示 <span className="text-slate-900 font-bold">{filteredAndSortedItems.length}</span> 項待辦
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

      {/* 待辦事項清單主體 */}
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
        <div className="space-y-2.5">
          {filteredAndSortedItems.map((item) => {
            const isDone = item.status === 'completed';
            const proj = projectMap.get(item.projectId);
            const projName = proj?.name || item.projectName || '未指定專案';
            const projCase = proj?.caseNumber || item.projectCaseNumber;
            const projClient = proj?.clientName || '燁輝';
            const projSource = proj?.sourceType;
            const projCategory = proj?.projectCategory || item.projectCategory || ((proj?.status as any) === 'poc' ? '評估案' : '已開案');

            const today = new Date();
            const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
            const diffDays = dueDateObj ? differenceInCalendarDays(today, dueDateObj) : 0;
            const isOverdue = !isDone && dueDateObj && diffDays > 0;
            const isUpcoming = !isDone && dueDateObj && diffDays >= -3 && diffDays <= 0;

            // 工期計算（自動，無需人工維護）
            const startedAtObj = item.startedAt ? new Date(item.startedAt) : null;
            const completedAtObj = item.completedAt ? new Date(item.completedAt) : null;
            const workDays = startedAtObj
              ? differenceInCalendarDays(isDone && completedAtObj ? completedAtObj : today, startedAtObj)
              : null;
            const delayCount = item.dueDateHistory?.length || 0;
            const delayTotalDays =
              item.originalDueDate && item.dueDate && item.originalDueDate !== item.dueDate
                ? differenceInCalendarDays(new Date(item.dueDate), new Date(item.originalDueDate))
                : 0;

            return (
              <div
                key={item.id}
                id={`task-item-${item.id}`}
                className={`p-3.5 rounded-lg border transition-all ${
                  isDone
                    ? 'bg-slate-50/70 border-slate-200/80 opacity-75'
                    : item.status === 'blocked'
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  {/* 左側：完成核取方塊 + 待辦標題 + 標籤 */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* 一鍵切換完成 (Checkbox) */}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onToggleComplete(item)}
                        className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-emerald-600 bg-white'
                        }`}
                        title={isDone ? '標記為未完成 (重新開啟)' : '標記為已完成'}
                      >
                        {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                      </button>
                    ) : (
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Hourglass className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* 對應專案標籤列 (清楚連結至所屬專案) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onSwitchToProjectView(item.projectId)}
                          className="inline-flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-200/90 group cursor-pointer"
                          title="點選切換至專案檢視並定位此專案"
                        >
                          <FolderGit2 className="h-3 w-3 text-slate-500 group-hover:text-slate-900" />
                          {projCase && <span className="font-mono text-slate-600">[{projCase}]</span>}
                          <span className="truncate max-w-[200px] sm:max-w-[320px]">{projName}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                        </button>

                        {/* 客戶名稱標籤 */}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                          <Building2 className="h-2.5 w-2.5 text-slate-400" />
                          {projClient}
                        </span>

                        {/* 專案來源型態 */}
                        {projSource === '億威內部自建專案' ? (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200 text-[10px] px-1.5 py-0 shadow-none font-medium">
                            🏭 億威自建
                          </Badge>
                        ) : (projSource === '其他專案' || projSource === '其他智慧製造專案') ? (
                          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-200 text-[10px] px-1.5 py-0 shadow-none font-medium">
                            ⚙️ 其他專案
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 text-[10px] px-1.5 py-0 shadow-none font-medium">
                            🏢 燁輝列管
                          </Badge>
                        )}

                        {/* 評估案 vs 已開案 */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-medium ${
                            projCategory === '評估案'
                              ? 'border-purple-300 text-purple-700 bg-purple-50/60'
                              : 'border-blue-300 text-blue-700 bg-blue-50/60'
                          }`}
                        >
                          {projCategory === '評估案' ? '📝 評估' : '🚀 開案'}
                        </Badge>
                      </div>

                      {/* 待辦項目標題與狀態 Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold text-slate-900 ${
                            isDone ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {item.title}
                        </span>

                        {getPhaseBadge(item.phase)}

                        {/* 卡關等候提示 (未完成時紅色明顯標註；已完成時淺灰色顯示) */}
                        {item.waitingOn && (
                          <Badge
                            variant={isDone ? 'outline' : 'destructive'}
                            className={
                              isDone
                                ? 'gap-1 font-normal text-xs px-2 py-0.5 bg-slate-100 text-slate-500 border-slate-200 shadow-none'
                                : 'gap-1 font-medium text-xs px-2 py-0.5 bg-rose-600 text-white shadow-xs'
                            }
                          >
                            {!isDone && <AlertCircle className="h-3 w-3" />}
                            等候：{item.waitingOn}
                          </Badge>
                        )}

                        {/* 責任歸屬 (單位/成員) */}
                        {item.owner && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                            <UserCheck className="h-3 w-3" />
                            責任: {item.owner}
                          </span>
                        )}
                      </div>

                      {/* 歷程說明 */}
                      {item.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/60 leading-relaxed max-w-3xl">
                          <span className="font-medium text-slate-700">歷程說明：</span>
                          {item.notes}
                        </p>
                      )}

                      {/* Lesson Learnt 經驗檢討 */}
                      {item.lessonLearnt && (
                        <p className="text-xs text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200/80 leading-relaxed max-w-3xl">
                          <span className="font-semibold text-amber-950">💡 經驗檢討 (Lesson Learnt)：</span>
                          {item.lessonLearnt}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 右側：時程跟催 + 工期 + 操作按鈕 */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end self-end sm:self-center shrink-0">
                    {item.dueDate ? (
                      <div className="text-right text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground justify-end">
                          <Calendar className="h-3 w-3" />
                          <span>預計: {item.dueDate}</span>
                        </div>

                        {isOverdue && (
                          <span className="text-rose-600 font-bold text-[11px] block mt-0.5">
                            🚨 已逾期 {diffDays} 天 (請跟催！)
                          </span>
                        )}

                        {isUpcoming && (
                          <span className="text-amber-600 font-semibold text-[11px] block mt-0.5">
                            ⏳ 剩餘 {Math.abs(diffDays)} 天到期
                          </span>
                        )}

                        {isDone && (
                          <span className="text-emerald-600 font-medium text-[11px] block mt-0.5">
                            ✅ 於 {item.completedAt ? item.completedAt.slice(0, 10) : '近期'} 完成
                          </span>
                        )}

                        {/* 工期與延期資訊（系統自動計算） */}
                        {workDays !== null && workDays >= 0 && (
                          <span className={`text-[11px] block mt-0.5 font-medium ${isDone ? 'text-slate-500' : 'text-blue-600'}`}>
                            ⏱ {isDone ? `工期 ${workDays} 天` : `已執行 ${workDays} 天`}
                          </span>
                        )}
                        {delayCount > 0 && (
                          <span className="text-[11px] block mt-0.5 text-orange-600 font-medium">
                            📅 延期 {delayCount} 次{delayTotalDays > 0 ? ` (+${delayTotalDays}天)` : ''}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-right text-xs text-muted-foreground">
                        <span>未設預計日</span>
                        {workDays !== null && workDays >= 0 && (
                          <span className={`text-[11px] block mt-0.5 font-medium ${isDone ? 'text-slate-500' : 'text-blue-600'}`}>
                            ⏱ {isDone ? `工期 ${workDays} 天` : `已執行 ${workDays} 天`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 操作按鈕 */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
