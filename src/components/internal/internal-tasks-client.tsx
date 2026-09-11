'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Bot, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Hourglass, 
  AlertTriangle, 
  UserCheck, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Check,
  FolderGit2,
  FolderPlus,
  Layers,
  ArrowUpDown,
  Filter,
  Rocket,
  Ban,
  RotateCcw
} from 'lucide-react';
import { differenceInCalendarDays, parseISO, isPast } from 'date-fns';
import { ActionItemDialog } from './action-item-dialog';
import { NewPocProjectDialog } from './new-poc-project-dialog';
import { AIAnalysisDialog } from './ai-analysis-dialog';
import { useAdmin } from '@/components/admin-context';
import { updateActionItem, deleteActionItem, updateInternalProjectStatus } from '@/lib/actions';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { FullProject, ProjectActionItem, ActionItemPhase, ActionItemStatus, User } from '@/types';

interface InternalTasksClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
  users?: User[];
}

export function InternalTasksClient({
  initialProjects,
  initialActionItems,
  users = [],
}: InternalTasksClientProps) {
  const { isAdmin } = useAdmin();
  const { toast } = useToast();

  const [projects, setProjects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  // 篩選與排序狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | '評估案' | '已開案'>('all');
  const [selectedInternalStatus, setSelectedInternalStatus] = useState<'all' | 'in_progress' | 'completed' | 'terminated'>('all');
  const [selectedProjectType, setSelectedProjectType] = useState<'all' | 'poc' | 'client'>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedWaitingOn, setSelectedWaitingOn] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'caseNumberAsc' | 'caseNumberDesc' | 'recentUpdated'>('caseNumberAsc');
  const [hideEmptyProjects, setHideEmptyProjects] = useState<boolean>(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // 彈窗狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pocDialogOpen, setPocDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectActionItem | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | undefined>();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTargetProjectId, setAiTargetProjectId] = useState<string | undefined>();
  const [aiTargetProjectName, setAiTargetProjectName] = useState<string | undefined>();

  // 整理所有不重複的「等候對象」標籤供快捷點選
  const uniqueWaitingOns = useMemo(() => {
    const set = new Set<string>();
    actionItems.forEach((item) => {
      if (item.waitingOn && item.waitingOn.trim()) {
        set.add(item.waitingOn.trim());
      }
    });
    return Array.from(set);
  }, [actionItems]);

  // KPI 總覽指標
  const kpiStats = useMemo(() => {
    const today = new Date();
    let blockedCount = 0;
    let overdueCount = 0;
    let completedCount = 0;
    let pendingCount = 0;

    actionItems.forEach((item) => {
      if (item.status === 'completed') {
        completedCount++;
      } else {
        pendingCount++;
        if (item.status === 'blocked') blockedCount++;
        if (item.dueDate) {
          const due = new Date(item.dueDate);
          if (differenceInCalendarDays(today, due) > 0) {
            overdueCount++;
          }
        }
      }
    });

    return {
      totalProjects: projects.length,
      totalItems: actionItems.length,
      pendingCount,
      blockedCount,
      overdueCount,
      completedCount,
    };
  }, [actionItems, projects]);

  // 過濾後的待辦清單
  const filteredItems = useMemo(() => {
    return actionItems.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.waitingOn && item.waitingOn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.owner && item.owner.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.projectName && item.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.projectCaseNumber && item.projectCaseNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPhase = selectedPhase === 'all' || item.phase === selectedPhase;
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchesWaiting = selectedWaitingOn === 'all' || item.waitingOn === selectedWaitingOn;

      return matchesSearch && matchesPhase && matchesStatus && matchesWaiting;
    });
  }, [actionItems, searchQuery, selectedPhase, selectedStatus, selectedWaitingOn]);

  // 統計評估案 vs 已開案
  const categoryCounts = useMemo(() => {
    let pocCount = 0;
    let activeCount = 0;
    projects.forEach((p) => {
      const cat = p.projectCategory || (p.status === 'poc' ? '評估案' : '已開案');
      if (cat === '評估案') pocCount++;
      else activeCount++;
    });
    return { all: projects.length, poc: pocCount, active: activeCount };
  }, [projects]);

  // 統計內部專案狀態 (進行中/評估中、已結案、專案終止)
  const internalStatusCounts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let terminated = 0;
    projects.forEach((p) => {
      const status = p.internalStatus || (p.status === 'completed' ? 'completed' : (p.status === 'cancelled' ? 'terminated' : 'in_progress'));
      if (status === 'completed') completed++;
      else if (status === 'terminated') terminated++;
      else inProgress++;
    });
    return { all: projects.length, inProgress, completed, terminated };
  }, [projects]);

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

  // 取得專案最新異動時間 (取待辦或專案本身最大時間)
  const getProjectRecentTimestamp = (proj: FullProject, projItems: ProjectActionItem[]) => {
    const toStr = (val: any) => (typeof val === 'string' ? val : val?.toISOString ? val.toISOString() : '');
    let maxTime = toStr(proj.updatedAt) || toStr(proj.createdAt) || '1970-01-01';
    for (const item of projItems) {
      const itTime = item.updatedAt || item.createdAt || item.dueDate || '';
      if (itTime > maxTime) maxTime = itTime;
    }
    return maxTime;
  };

  // 將待辦項目按所屬專案分組
  const groupedByProject = useMemo(() => {
    let projectList = [...projects];

    // 1. 類別篩選 (評估案 vs 已開案)
    if (selectedCategory !== 'all') {
      projectList = projectList.filter((p) => {
        const cat = p.projectCategory || (p.status === 'poc' ? '評估案' : '已開案');
        return cat === selectedCategory;
      });
    }

    // 2. 專案生命週期狀態篩選 (進行中/評估中、已結案、專案終止)
    if (selectedInternalStatus !== 'all') {
      projectList = projectList.filter((p) => {
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : (p.status === 'cancelled' ? 'terminated' : 'in_progress'));
        return status === selectedInternalStatus;
      });
    }

    // 3. 舊專案類型相容 (poc vs client)
    if (selectedProjectType === 'poc') {
      projectList = projectList.filter((p) => p.status === 'poc');
    } else if (selectedProjectType === 'client') {
      projectList = projectList.filter((p) => p.status !== 'poc');
    }

    const map = new Map<string, { project: FullProject; items: ProjectActionItem[] }>();

    projectList.forEach((proj) => {
      map.set(proj.id, { project: proj, items: [] });
    });

    filteredItems.forEach((item) => {
      const entry = map.get(item.projectId);
      if (entry) {
        entry.items.push(item);
      } else {
        // 若此待辦所屬專案存在於系統專案名單中，表示該專案已被目前條件 (如已結案/類別/專案類型) 過濾，不可重新加入！
        const projectExists = projects.some((p) => p.id === item.projectId);
        if (!projectExists && selectedCategory === 'all' && selectedInternalStatus === 'all' && selectedProjectType === 'all') {
          // 僅當為資料庫完全不存在的孤兒資料，且處於「全部無篩選」狀態時，才暫存為未分類專案
          const dummyProj: FullProject = {
            id: item.projectId,
            caseNumber: item.projectCaseNumber || 'N/A',
            name: item.projectName || '未分類專案',
            status: 'active',
            projectCategory: item.projectCategory || '已開案',
            createdAt: item.createdAt,
            createdBy: '',
            subProjects: [],
          };
          map.set(item.projectId, { project: dummyProj, items: [item] });
        }
      }
    });

    const queryLower = searchQuery.trim().toLowerCase();

    // 3. 搜尋與空專案過濾
    const result = Array.from(map.values()).filter((group) => {
      // 專案本身是否符合搜尋關鍵字 (案名、案號、窗口)
      const projectMatchesSearch = queryLower
        ? group.project.name.toLowerCase().includes(queryLower) ||
          (group.project.caseNumber && group.project.caseNumber.toLowerCase().includes(queryLower)) ||
          (group.project.tpmOfficeContact && group.project.tpmOfficeContact.toLowerCase().includes(queryLower))
        : false;

      // 如果使用者有設定 phase/status/waitingOn，而專案沒有符合條件的待辦事項，則過濾掉
      const hasPhaseOrStatusFilter = selectedPhase !== 'all' || selectedStatus !== 'all' || selectedWaitingOn !== 'all';
      if (hasPhaseOrStatusFilter) {
        return group.items.length > 0;
      }

      // 如果使用者有輸入搜尋字串：
      // - 只要專案本身符合搜尋 (即使該案無待辦事項) -> 顯示！
      // - 或者其下的待辦事項有符合搜尋 (items.length > 0) -> 顯示！
      if (queryLower) {
        return projectMatchesSearch || group.items.length > 0;
      }

      // 無搜尋字串時：若使用者勾選「只顯示有待辦專案」，則只有 items.length > 0 才顯示
      if (hideEmptyProjects) {
        return group.items.length > 0;
      }

      return true;
    });

    // 4. 排序 (案號正序/倒序、最近更新)
    result.sort((a, b) => {
      if (sortBy === 'caseNumberAsc') {
        return compareCaseNumbers(a.project.caseNumber, b.project.caseNumber, true);
      } else if (sortBy === 'caseNumberDesc') {
        return compareCaseNumbers(a.project.caseNumber, b.project.caseNumber, false);
      } else if (sortBy === 'recentUpdated') {
        const timeA = getProjectRecentTimestamp(a.project, a.items);
        const timeB = getProjectRecentTimestamp(b.project, b.items);
        return timeB.localeCompare(timeA); // 最近更新在最上面
      }
      return 0;
    });

    return result;
  }, [
    projects,
    filteredItems,
    searchQuery,
    selectedCategory,
    selectedInternalStatus,
    selectedProjectType,
    selectedPhase,
    selectedStatus,
    selectedWaitingOn,
    sortBy,
    hideEmptyProjects,
  ]);

  const toggleCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleOpenAdd = (projectId?: string) => {
    setEditingItem(null);
    setDefaultProjectId(projectId);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ProjectActionItem) => {
    setEditingItem(item);
    setDefaultProjectId(item.projectId);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆待辦歷程嗎？此操作無法還原。')) return;
    try {
      const res = await deleteActionItem(id);
      if (res.success) {
        setActionItems((prev) => prev.filter((i) => i.id !== id));
        toast({ title: '已成功刪除' });
      } else {
        toast({ title: '刪除失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '刪除異常', description: err.message, variant: 'destructive' });
    }
  };

  const handleQuickToggleComplete = async (item: ProjectActionItem) => {
    const newStatus = item.status === 'completed' ? 'in_progress' : 'completed';
    try {
      const res = await updateActionItem(item.id, { status: newStatus });
      if (res.success) {
        setActionItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
        );
        toast({
          title: newStatus === 'completed' ? '已標記為完成！' : '已重新開啟待辦',
        });
      }
    } catch (err: any) {
      toast({ title: '狀態更新失敗', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateProjectStatus = async (projectId: string, payload: {
    category?: '評估案' | '已開案';
    internalStatus?: 'in_progress' | 'completed' | 'terminated';
  }) => {
    try {
      const res = await updateInternalProjectStatus(projectId, payload);
      if (res.success) {
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const updatedCategory = payload.category ?? p.projectCategory;
            const updatedInternalStatus = payload.internalStatus ?? p.internalStatus;
            return {
              ...p,
              projectCategory: updatedCategory,
              internalStatus: updatedInternalStatus,
              autoCompletedByClient: payload.internalStatus === 'in_progress' ? false : p.autoCompletedByClient,
            };
          })
        );
        toast({ title: res.message });
      } else {
        toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '操作異常', description: err.message, variant: 'destructive' });
    }
  };

  const handleOpenAI = (projectId?: string, projectName?: string) => {
    setAiTargetProjectId(projectId);
    setAiTargetProjectName(projectName);
    setAiDialogOpen(true);
  };

  // 輔助取得階段顏色
  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case '評估階段':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">評估階段</Badge>;
      case '報價/設計':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">報價/設計</Badge>;
      case '簽呈核決':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">簽呈核決</Badge>;
      case '開發/施工':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">開發/施工</Badge>;
      case '驗證測試':
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-300">驗證測試</Badge>;
      case '驗收結案':
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">驗收結案</Badge>;
      default:
        return <Badge variant="outline">{phase}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 頂部標題與行動列 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              內部專案管制與待辦歷程追蹤
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              內部管制專用
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            針對 50~70 個列管專案，即時掌握「等誰處理 (Waiting-on)」、「階段進程」、「跟催期限」與「AI 延誤診斷」。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenAI()}
            variant="outline"
            className="gap-1.5 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100"
          >
            <Bot className="h-4 w-4 text-indigo-600" />
            AI 全專案延誤診斷
          </Button>

          {isAdmin && (
            <>
              <Button
                onClick={() => setPocDialogOpen(true)}
                variant="outline"
                className="gap-1.5 border-purple-300 bg-purple-50/70 text-purple-800 hover:bg-purple-100 hover:text-purple-950 shadow-xs"
              >
                <FolderPlus className="h-4 w-4 text-purple-600" />
                新增內部專案 (POC / 評估)
              </Button>

              <Button onClick={() => handleOpenAdd()} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                新增待辦 / 歷程
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI 核心統計指標卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="shadow-none border bg-slate-50/50">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">列管專案總數</div>
              <div className="text-xl font-bold text-slate-800">{kpiStats.totalProjects} 個</div>
            </div>
            <FolderGit2 className="h-7 w-7 text-slate-400" />
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-blue-50/40 border-blue-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-700">總待辦事項</div>
              <div className="text-xl font-bold text-blue-900">{kpiStats.totalItems} 項</div>
            </div>
            <Layers className="h-7 w-7 text-blue-400" />
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-rose-50 border-rose-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-rose-700 font-semibold">🚨 卡關等候中 (Blocked)</div>
              <div className="text-xl font-bold text-rose-600">{kpiStats.blockedCount} 項</div>
            </div>
            <AlertCircle className="h-7 w-7 text-rose-500" />
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-amber-50 border-amber-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-700 font-semibold">⚠️ 逾期未完成 (需跟催)</div>
              <div className="text-xl font-bold text-amber-700">{kpiStats.overdueCount} 項</div>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-emerald-50/50 border-emerald-200 col-span-2 md:col-span-1">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-700">已完結項目</div>
              <div className="text-xl font-bold text-emerald-700">{kpiStats.completedCount} 項</div>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {/* 專案類別快速切換標籤 (評估案 vs 已開案) 與排序設定 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* 類別分頁按鈕 */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200/80 w-fit">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            全部專案 ({categoryCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('評估案')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === '評估案'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-800 hover:bg-purple-100/70'
            }`}
          >
            <span>📝 評估案 (POC)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                selectedCategory === '評估案' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {categoryCounts.poc}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('已開案')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === '已開案'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-800 hover:bg-blue-100/70'
            }`}
          >
            <span>🚀 已開案 (執行中)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                selectedCategory === '已開案' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {categoryCounts.active}
            </span>
          </button>
        </div>

        {/* 排序方式與無待辦專案顯示開關 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              排序:
            </span>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-[170px] h-8 text-xs bg-white">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caseNumberAsc">🔢 案號由小到大 (1→55)</SelectItem>
                <SelectItem value="caseNumberDesc">🔢 案號由大到小 (55→1)</SelectItem>
                <SelectItem value="recentUpdated">🕒 依照最近更新/待辦</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={hideEmptyProjects ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setHideEmptyProjects((prev) => !prev)}
            className="h-8 text-xs gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            {hideEmptyProjects ? '已隱藏無待辦專案' : '顯示所有專案 (含無待辦)'}
          </Button>
        </div>
      </div>

      {/* 搜尋與複合過濾列 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋專案名稱、案號、事項、等候對象 (如: 億威、採購)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 專案來源篩選 */}
          <Select value={selectedProjectType} onValueChange={(val: any) => setSelectedProjectType(val)}>
            <SelectTrigger className="w-[145px] h-9 text-xs font-medium">
              <SelectValue placeholder="專案類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部來源 ({projects.length})</SelectItem>
              <SelectItem value="poc">🧪 內部自建專案 ({projects.filter(p => p.status === 'poc').length})</SelectItem>
              <SelectItem value="client">🏢 燁輝客戶列管 ({projects.filter(p => p.status !== 'poc').length})</SelectItem>
            </SelectContent>
          </Select>

          {/* 專案生命週期狀態篩選 */}
          <Select value={selectedInternalStatus} onValueChange={(val: any) => setSelectedInternalStatus(val)}>
            <SelectTrigger className="w-[145px] h-9 text-xs font-medium">
              <SelectValue placeholder="專案狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部專案狀態 ({projects.length})</SelectItem>
              <SelectItem value="in_progress">⏳ 進行/評估中 ({internalStatusCounts.inProgress})</SelectItem>
              <SelectItem value="completed">✅ 已結案 ({internalStatusCounts.completed})</SelectItem>
              <SelectItem value="terminated">⛔ 專案終止 ({internalStatusCounts.terminated})</SelectItem>
            </SelectContent>
          </Select>

          {/* 階段篩選 */}
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
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

          {/* 狀態篩選 */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="狀態篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部待辦狀態</SelectItem>
              <SelectItem value="pending">待處理</SelectItem>
              <SelectItem value="in_progress">處理中</SelectItem>
              <SelectItem value="blocked">🚨 卡關等候中</SelectItem>
              <SelectItem value="completed">✅ 已完成</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || selectedCategory !== 'all' || selectedInternalStatus !== 'all' || selectedProjectType !== 'all' || selectedPhase !== 'all' || selectedStatus !== 'all' || selectedWaitingOn !== 'all' || hideEmptyProjects) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedInternalStatus('all');
                setSelectedProjectType('all');
                setSelectedPhase('all');
                setSelectedStatus('all');
                setSelectedWaitingOn('all');
                setSortBy('caseNumberAsc');
                setHideEmptyProjects(false);
              }}
              className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
            >
              重置
            </Button>
          )}
        </div>
      </div>

      {/* 快捷「等誰處理 (Waiting On)」標籤列 */}
      {uniqueWaitingOns.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-muted-foreground font-medium mr-1">🔍 快速過濾等候對象:</span>
          <button
            onClick={() => setSelectedWaitingOn('all')}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
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
              onClick={() => setSelectedWaitingOn(selectedWaitingOn === party ? 'all' : party)}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors flex items-center gap-1 ${
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

      {/* 專案與待辦列表 */}
      <div className="space-y-4">
        {groupedByProject.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-card">
            <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="text-base font-semibold text-slate-700">查無符合條件的待辦事項</h3>
            <p className="text-xs text-muted-foreground mt-1">
              可嘗試清除搜尋條件，或點選右上角「新增待辦 / 歷程」為專案建立事件。
            </p>
          </div>
        ) : (
          groupedByProject.map(({ project, items }) => {
            const isCollapsed = !!collapsedProjects[project.id];
            const blockedItems = items.filter((i) => i.status === 'blocked');
            const overdueItems = items.filter((i) => {
              if (i.status === 'completed' || !i.dueDate) return false;
              return differenceInCalendarDays(new Date(), new Date(i.dueDate)) > 0;
            });

            const isEvalCategory = (project.projectCategory || (project.status === 'poc' ? '評估案' : '已開案')) === '評估案';
            const internalStatus = project.internalStatus || (project.status === 'completed' ? 'completed' : (project.status === 'cancelled' ? 'terminated' : 'in_progress'));
            const isCompleted = internalStatus === 'completed';
            const isTerminated = internalStatus === 'terminated';
            const isInProgress = !isCompleted && !isTerminated;

            return (
              <div
                key={project.id}
                className={`rounded-lg border bg-card shadow-sm transition-all overflow-hidden ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/10' : isTerminated ? 'border-rose-200 opacity-80' : ''
                }`}
              >
                {/* 專案卡片標頭 */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-3 ${
                  isCompleted ? 'bg-emerald-50/40' : isTerminated ? 'bg-rose-50/30' : 'bg-slate-50/80'
                }`}>
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      onClick={() => toggleCollapse(project.id)}
                      className="mt-0.5 sm:mt-0 p-1 rounded hover:bg-slate-200 transition-colors text-slate-600"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {project.caseNumber && (
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {project.caseNumber}
                          </span>
                        )}
                        <h2 className="text-base font-bold text-slate-900">{project.name}</h2>
                        
                        {/* 專案類別標籤 */}
                        {isEvalCategory ? (
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] px-2 py-0.5 shadow-xs flex items-center gap-1">
                            <span>📝 評估案</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2 py-0.5 shadow-xs flex items-center gap-1">
                            <span>🚀 已開案</span>
                          </Badge>
                        )}

                        {/* 專案生命週期狀態標籤 */}
                        {isCompleted ? (
                          project.autoCompletedByClient ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 py-0.5 shadow-xs flex items-center gap-1">
                              <span>🏆 客戶管制表已結案 (自動轉換)</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 py-0.5 shadow-xs flex items-center gap-1">
                              <span>✅ 已結案</span>
                            </Badge>
                          )
                        ) : isTerminated ? (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-[11px] px-2 py-0.5 flex items-center gap-1">
                            <span>⛔ 專案終止</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[11px] px-2 py-0.5">
                            {isEvalCategory ? '評估中' : '執行中'}
                          </Badge>
                        )}

                        {/* 關聯客戶管制表標籤 */}
                        {project.linkedCustomerProjectId ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] px-2 py-0.5 flex items-center gap-1">
                            <span>🔗 已連結客戶管制表</span>
                          </Badge>
                        ) : project.status !== 'poc' && (
                          <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px] px-2 py-0.5">
                            🏢 燁輝客戶列管
                          </Badge>
                        )}

                        {project.tpmOfficeContact && (
                          <span className="text-xs text-muted-foreground">
                            TPM窗口: {project.tpmOfficeContact}
                          </span>
                        )}
                      </div>

                      {/* 專案待辦指標小徽章 */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span>待辦總數: {items.length} 項</span>
                        {blockedItems.length > 0 && (
                          <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                            <AlertCircle className="h-3 w-3" />
                            {blockedItems.length} 項卡關中
                          </span>
                        )}
                        {overdueItems.length > 0 && (
                          <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            {overdueItems.length} 項逾期
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 專案右側操作按鈕 */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                    {/* 管理員專案狀態生命週期變更 */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {/* 評估案專屬捷徑：一鍵轉為已開案 */}
                        {isEvalCategory && isInProgress && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateProjectStatus(project.id, { category: '已開案' })}
                            className="gap-1 text-xs h-8 border-blue-300 bg-blue-50/70 text-blue-700 hover:bg-blue-100 hover:text-blue-900 shadow-2xs font-medium"
                            title="評估通過，轉為已開案正式執行"
                          >
                            <Rocket className="h-3.5 w-3.5 text-blue-600" />
                            轉為已開案
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 text-xs h-8 text-slate-700 bg-white shadow-2xs">
                              <span>狀態管理</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 text-xs">
                            {isEvalCategory && isInProgress && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateProjectStatus(project.id, { category: '已開案' })}
                                className="cursor-pointer py-1.5"
                              >
                                <Rocket className="h-3.5 w-3.5 text-blue-600 mr-2" />
                                轉為已開案 (進入正式執行)
                              </DropdownMenuItem>
                            )}
                            {isInProgress && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateProjectStatus(project.id, { internalStatus: 'completed' })}
                                  className="cursor-pointer py-1.5 text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-2" />
                                  手動標記為已結案
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateProjectStatus(project.id, { internalStatus: 'terminated' })}
                                  className="cursor-pointer py-1.5 text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                                >
                                  <Ban className="h-3.5 w-3.5 text-rose-600 mr-2" />
                                  專案終止 (不繼續執行)
                                </DropdownMenuItem>
                              </>
                            )}
                            {(isCompleted || isTerminated) && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateProjectStatus(project.id, { internalStatus: 'in_progress' })}
                                className="cursor-pointer py-1.5 text-blue-700 focus:text-blue-800 focus:bg-blue-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-blue-600 mr-2" />
                                重新開啟專案 (重設為進行中)
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAI(project.id, project.name)}
                      className="gap-1 text-xs text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 h-8"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      AI 診斷此案
                    </Button>

                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdd(project.id)}
                        className="gap-1 text-xs h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        新增事項
                      </Button>
                    )}
                  </div>
                </div>

                {/* 待辦事項清單 */}
                {!isCollapsed && (
                  <div className="p-4 divide-y">
                    {items.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground bg-slate-50/40 rounded border border-dashed border-slate-200">
                        此專案尚未建立任何待辦或歷程項目。
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAdd(project.id)}
                            className="text-primary font-medium underline ml-1 hover:text-primary/80"
                          >
                            + 立即為此案建立待辦事項
                          </button>
                        )}
                      </div>
                    ) : (
                      items.map((item) => {
                        const isDone = item.status === 'completed';
                        const isBlocked = item.status === 'blocked';
                        const today = new Date();
                        const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
                        const diffDays = dueDateObj
                          ? differenceInCalendarDays(today, dueDateObj)
                          : 0;
                        const isOverdue = !isDone && dueDateObj && diffDays > 0;
                        const isUpcoming = !isDone && dueDateObj && diffDays >= -3 && diffDays <= 0;

                        return (
                          <div
                            key={item.id}
                            className={`py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors ${
                              isDone ? 'opacity-65' : ''
                            }`}
                          >
                            {/* 左側：完成核選鈕 + 標題 + 標籤 + 歷程 */}
                            <div className="flex items-start gap-2.5 flex-1">
                              {/* 一鍵切換完成 */}
                              {isAdmin ? (
                                <button
                                  onClick={() => handleQuickToggleComplete(item)}
                                  className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                                    isDone
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-slate-300 hover:border-slate-500 bg-white'
                                  }`}
                                  title={isDone ? '標記為未完成' : '標記為已完成'}
                                >
                                  {isDone && <Check className="h-3.5 w-3.5" />}
                                </button>
                              ) : (
                                <div className="mt-1">
                                  {isDone ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Hourglass className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                              )}

                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-sm font-semibold text-slate-900 ${
                                      isDone ? 'line-through text-slate-500' : ''
                                    }`}
                                  >
                                    {item.title}
                                  </span>

                                  {/* 專案類別標籤 */}
                                  {item.projectCategory && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 font-medium ${
                                        item.projectCategory === '評估案'
                                          ? 'border-purple-300 text-purple-700 bg-purple-50/60'
                                          : 'border-blue-300 text-blue-700 bg-blue-50/60'
                                      }`}
                                    >
                                      {item.projectCategory === '評估案' ? '📝 評估' : '🚀 開案'}
                                    </Badge>
                                  )}

                                  {getPhaseBadge(item.phase)}

                                  {/* 卡關等候提示 (超顯眼紅標) */}
                                  {item.waitingOn && (
                                    <Badge
                                      variant="destructive"
                                      className="gap-1 font-medium text-xs px-2 py-0.5 bg-rose-600 text-white shadow-xs"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      等候：{item.waitingOn}
                                    </Badge>
                                  )}

                                  {/* 內部負責人 */}
                                  {item.owner && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                      <UserCheck className="h-3 w-3" />
                                      負責人: {item.owner}
                                    </span>
                                  )}
                                </div>

                                {/* 歷程說明 */}
                                {item.notes && (
                                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/60 leading-relaxed">
                                    <span className="font-medium text-slate-700">歷程說明：</span>
                                    {item.notes}
                                  </p>
                                )}

                                {/* Lesson Learnt 經驗檢討 */}
                                {item.lessonLearnt && (
                                  <p className="text-xs text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200/80 leading-relaxed">
                                    <span className="font-semibold text-amber-950">💡 經驗檢討 (Lesson Learnt)：</span>
                                    {item.lessonLearnt}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* 右側：預計完成日跟催燈號 + 操作按鈕 */}
                            <div className="flex items-center gap-3 sm:flex-col sm:items-end self-end sm:self-center shrink-0">
                              {/* 預計完成日與跟催燈號 */}
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
                                      ✅ 已於 {item.completedAt ? item.completedAt.slice(0, 10) : '近期'} 完成
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">未設預計日</span>
                              )}

                              {/* 管理員編輯/刪除按鈕 */}
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEdit(item)}
                                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                                    title="編輯事項"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                                    title="刪除事項"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 待辦事項彈窗 */}
      <ActionItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        defaultProjectId={defaultProjectId}
        projects={projects}
        users={users}
        onSuccess={() => {
          // 重新載入或重刷
          window.location.reload();
        }}
      />

      {/* 新增內部專案 (POC) 彈窗 */}
      <NewPocProjectDialog
        open={pocDialogOpen}
        onOpenChange={setPocDialogOpen}
        users={users}
        onSuccess={(newProj) => {
          if (newProj) {
            setProjects((prev) => [newProj, ...prev]);
          } else {
            window.location.reload();
          }
        }}
      />

      {/* AI 分析彈窗 */}
      <AIAnalysisDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        projectId={aiTargetProjectId}
        projectName={aiTargetProjectName}
      />
    </div>
  );
}
