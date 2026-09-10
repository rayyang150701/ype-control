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
  Layers
} from 'lucide-react';
import { differenceInCalendarDays, parseISO, isPast } from 'date-fns';
import { ActionItemDialog } from './action-item-dialog';
import { AIAnalysisDialog } from './ai-analysis-dialog';
import { useAdmin } from '@/components/admin-context';
import { updateActionItem, deleteActionItem } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import type { FullProject, ProjectActionItem, ActionItemPhase, ActionItemStatus } from '@/types';

interface InternalTasksClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
}

export function InternalTasksClient({
  initialProjects,
  initialActionItems,
}: InternalTasksClientProps) {
  const { isAdmin } = useAdmin();
  const { toast } = useToast();

  const [projects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  // 篩選狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedWaitingOn, setSelectedWaitingOn] = useState<string>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // 彈窗狀態
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // 將待辦項目按所屬專案分組
  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: FullProject; items: ProjectActionItem[] }>();

    projects.forEach((proj) => {
      map.set(proj.id, { project: proj, items: [] });
    });

    filteredItems.forEach((item) => {
      const entry = map.get(item.projectId);
      if (entry) {
        entry.items.push(item);
      } else {
        // 若找不到對應專案，放進暫存專案
        const dummyProj: FullProject = {
          id: item.projectId,
          caseNumber: item.projectCaseNumber || 'N/A',
          name: item.projectName || '未分類專案',
          status: 'active',
          createdAt: item.createdAt,
          createdBy: '',
          subProjects: [],
        };
        map.set(item.projectId, { project: dummyProj, items: [item] });
      }
    });

    // 只保留有待辦事項的專案，或者在無搜尋過濾時列出所有專案
    return Array.from(map.values()).filter((group) => {
      if (searchQuery || selectedPhase !== 'all' || selectedStatus !== 'all' || selectedWaitingOn !== 'all') {
        return group.items.length > 0;
      }
      return true;
    });
  }, [projects, filteredItems, searchQuery, selectedPhase, selectedStatus, selectedWaitingOn]);

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
            <Button onClick={() => handleOpenAdd()} className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              新增待辦 / 歷程
            </Button>
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

      {/* 搜尋與複合過濾列 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋專案、案號、事項、等候對象 (如: 億威、採購)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>

        <div className="flex items-center gap-2">
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
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="pending">待處理</SelectItem>
              <SelectItem value="in_progress">處理中</SelectItem>
              <SelectItem value="blocked">🚨 卡關等候中</SelectItem>
              <SelectItem value="completed">✅ 已完成</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || selectedPhase !== 'all' || selectedStatus !== 'all' || selectedWaitingOn !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedPhase('all');
                setSelectedStatus('all');
                setSelectedWaitingOn('all');
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

            return (
              <div
                key={project.id}
                className="rounded-lg border bg-card shadow-sm transition-all overflow-hidden"
              >
                {/* 專案卡片標頭 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/80 border-b gap-3">
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
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {project.caseNumber}
                        </span>
                        <h2 className="text-base font-bold text-slate-900">{project.name}</h2>
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
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
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
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        此專案尚未建立任何待辦或歷程項目。
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAdd(project.id)}
                            className="text-primary underline ml-1 hover:text-primary/80"
                          >
                            立即建立
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
        onSuccess={() => {
          // 重新載入或重刷
          window.location.reload();
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
