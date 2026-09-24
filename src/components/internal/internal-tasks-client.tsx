'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  RotateCcw,
  Building2,
  Users,
  Lock,
  Paperclip,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { differenceInCalendarDays, parseISO, isPast } from 'date-fns';
import { copyToClipboard } from '@/lib/utils';
import { ActionItemDialog } from './action-item-dialog';
import { NewPocProjectDialog } from './new-poc-project-dialog';
import { EditInternalProjectDialog } from './edit-internal-project-dialog';
import { AIAnalysisDialog } from './ai-analysis-dialog';
import { TaskCentricView } from './task-centric-view';
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
import type { FullProject, ProjectActionItem, ActionItemPhase, ActionItemStatus, User, Client, ProjectSourceType } from '@/types';

interface InternalTasksClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
  users?: User[];
  clients?: Client[];
}

export function InternalTasksClient({
  initialProjects,
  initialActionItems,
  users = [],
  clients = [],
}: InternalTasksClientProps) {
  const { isAdmin, isEditor, isGuest, isLoaded, setIsLoginDialogOpen } = useAdmin();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightParam = searchParams.get('highlight') || searchParams.get('projectId');
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

  const [projects, setProjects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setActionItems(initialActionItems);
  }, [initialActionItems]);

  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  const handleCopyAttachmentLink = async (url: string, fileName: string, fileId?: string) => {
    if (!url || url === '#') {
      toast({ title: '無法複製', description: '無效的檔案雲端連結', variant: 'destructive' });
      return;
    }
    const success = await copyToClipboard(url);
    if (success) {
      if (fileId) setCopiedFileId(fileId);
      setTimeout(() => {
        setCopiedFileId((prev) => (prev === fileId ? null : prev));
      }, 2000);
      toast({
        title: '已複製雲端分享連結',
        description: `檔案「${fileName}」的 Google Drive 雲端連結已複製到剪貼簿，可直接發送給他人下載/檢視！`,
      });
    } else {
      toast({
        title: '複製失敗',
        description: '無法存取剪貼簿，請手動複製連結網址',
        variant: 'destructive',
      });
    }
  };

  // 視圖模式：'project' (依專案分組檢視) vs 'task' (以待辦項目為主總覽)
  const [viewMode, setViewMode] = useState<'project' | 'task'>('project');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('internal_tasks_view_mode');
      if (saved === 'project' || saved === 'task') {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: 'project' | 'task') => {
    setViewMode(mode);
    try {
      localStorage.setItem('internal_tasks_view_mode', mode);
    } catch {}
  };

  // 外部超連結帶入專案 ID 快速定位與展開聚焦 (如自儀表板跳轉前往)
  useEffect(() => {
    if (!highlightParam) return;

    // 1. 強制切換為專案分組檢視
    handleSetViewMode('project');

    // 2. 清除可能導致該目標專案被過濾隱藏的條件
    setSelectedCategory('all');
    setSelectedInternalStatus('all');
    setSelectedSourceType('all');
    setSelectedClient('all');
    setSelectedPhase('all');
    setSelectedStatus('all');
    setSelectedWaitingOn('all');
    setSearchQuery('');
    setHideEmptyProjects(false);

    // 3. 自動展開該目標專案
    setCollapsedProjects((prev) => ({ ...prev, [highlightParam]: false }));
    setHighlightedProjectId(highlightParam);

    // 4. 平滑滾動定位至目標專案位置
    const timer = setTimeout(() => {
      const el = document.getElementById(`project-${highlightParam}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [highlightParam]);

  // 篩選與排序狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | '評估案' | '已開案' | '已結案' | '專案終止'>('all');
  const [selectedInternalStatus, setSelectedInternalStatus] = useState<'all' | 'in_progress' | 'completed' | 'terminated'>('all');
  const [selectedSourceType, setSelectedSourceType] = useState<'all' | ProjectSourceType>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedWaitingOn, setSelectedWaitingOn] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'caseNumberAsc' | 'caseNumberDesc' | 'recentUpdated'>('caseNumberAsc');
  const [hideEmptyProjects, setHideEmptyProjects] = useState<boolean>(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [showCompletedMap, setShowCompletedMap] = useState<Record<string, boolean>>({});

  // 彈窗狀態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pocDialogOpen, setPocDialogOpen] = useState(false);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<FullProject | null>(null);
  const [editingItem, setEditingItem] = useState<ProjectActionItem | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | undefined>();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTargetProjectId, setAiTargetProjectId] = useState<string | undefined>();
  const [aiTargetProjectName, setAiTargetProjectName] = useState<string | undefined>();

  // 建立專案快速查找 Map (以 projectId 為 key)
  const projectMap = useMemo(() => {
    const map = new Map<string, FullProject>();
    projects.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [projects]);

  // 待辦工作總覽的狀態頁籤 (需求2 方法1)
  const [activeTaskTab, setActiveTaskTab] = useState<'all' | 'blocked' | 'overdue' | 'active' | 'completed'>('all');

  // 計算待辦工作總覽各狀態數量 (用於頂部快速選項)
  const taskTabCounts = useMemo(() => {
    const today = new Date();
    let blockedCount = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let completedCount = 0;

    actionItems.forEach((item) => {
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
      all: actionItems.length,
      blocked: blockedCount,
      overdue: overdueCount,
      active: activeCount,
      completed: completedCount,
    };
  }, [actionItems]);

  // 需求1: 整理所有不重複且未結案、未完成的「等候對象」標籤供快捷點選
  const uniqueWaitingOns = useMemo(() => {
    const set = new Set<string>();
    actionItems.forEach((item) => {
      if (item.status === 'completed') return;
      const proj = projectMap.get(item.projectId);
      if (proj && (proj.internalStatus === 'completed' || proj.status === 'completed')) return;
      if (item.waitingOn && item.waitingOn.trim()) {
        set.add(item.waitingOn.trim());
      }
    });
    return Array.from(set);
  }, [actionItems, projectMap]);

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
      
      // 需求1: 等候處理篩選時，過濾已完成的待辦與已結案專案
      const matchesWaiting = selectedWaitingOn === 'all' || (
        item.waitingOn === selectedWaitingOn &&
        item.status !== 'completed' &&
        !(projectMap.get(item.projectId)?.internalStatus === 'completed' || projectMap.get(item.projectId)?.status === 'completed')
      );

      return matchesSearch && matchesPhase && matchesStatus && matchesWaiting;
    });
  }, [actionItems, searchQuery, selectedPhase, selectedStatus, selectedWaitingOn, projectMap]);

  // 統計評估案 vs 已開案 vs 已結案 vs 專案終止
  const categoryCounts = useMemo(() => {
    let pocCount = 0;
    let activeCount = 0;
    let completedCount = 0;
    let terminatedCount = 0;
    projects.forEach((p) => {
      const status = p.internalStatus || (p.status === 'completed' ? 'completed' : ((p.status as any) === 'cancelled' ? 'terminated' : 'in_progress'));
      if (status === 'completed') {
        completedCount++;
      } else if (status === 'terminated') {
        terminatedCount++;
      } else {
        const cat = p.projectCategory || ((p.status as any) === 'poc' ? '評估案' : '已開案');
        if (cat === '評估案') pocCount++;
        else activeCount++;
      }
    });
    return { all: projects.length, poc: pocCount, active: activeCount, completed: completedCount, terminated: terminatedCount };
  }, [projects]);

  // 整理所有客戶選項與專案數量統計
  const clientFilterOptions = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      const c = p.clientName || '燁輝';
      map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
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

    // 1. 類別與生命週期標籤篩選 (評估案 vs 已開案 vs 已結案)
    if (selectedCategory === '評估案') {
      projectList = projectList.filter((p) => {
        const cat = p.projectCategory || (p.status === 'poc' ? '評估案' : '已開案');
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : (p.status === 'cancelled' ? 'terminated' : 'in_progress'));
        return cat === '評估案' && status !== 'completed' && status !== 'terminated';
      });
    } else if (selectedCategory === '已開案') {
      projectList = projectList.filter((p) => {
        const cat = p.projectCategory || (p.status === 'poc' ? '評估案' : '已開案');
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : (p.status === 'cancelled' ? 'terminated' : 'in_progress'));
        return cat === '已開案' && status !== 'completed' && status !== 'terminated';
      });
    } else if (selectedCategory === '已結案') {
      projectList = projectList.filter((p) => {
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : ((p.status as any) === 'cancelled' ? 'terminated' : 'in_progress'));
        return status === 'completed';
      });
    } else if (selectedCategory === '專案終止') {
      projectList = projectList.filter((p) => {
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : ((p.status as any) === 'cancelled' ? 'terminated' : 'in_progress'));
        return status === 'terminated';
      });
    }

    // 2. 專案生命週期狀態篩選 (進行中/評估中、已結案、專案終止)
    if (selectedInternalStatus !== 'all') {
      projectList = projectList.filter((p) => {
        const status = p.internalStatus || (p.status === 'completed' ? 'completed' : ((p.status as any) === 'cancelled' ? 'terminated' : 'in_progress'));
        return status === selectedInternalStatus;
      });
    }

    // 3. 專案來源型態篩選 (燁輝列管專案 vs 億威內部自建專案 vs 其他專案)
    if (selectedSourceType !== 'all') {
      projectList = projectList.filter((p) => {
        const src = p.sourceType || (p.projectCategory === '評估案' || (p.status as any) === 'poc' ? '億威內部自建專案' : '燁輝列管專案');
        if (selectedSourceType === '其他專案' || selectedSourceType === '其他智慧製造專案') {
          return src === '其他專案' || src === '其他智慧製造專案';
        }
        return src === selectedSourceType;
      });
    }

    // 4. 客戶篩選
    if (selectedClient !== 'all') {
      projectList = projectList.filter((p) => (p.clientName || '燁輝') === selectedClient);
    }

    const map = new Map<string, { project: FullProject; items: ProjectActionItem[] }>();
    const caseNumberMap = new Map<string, { project: FullProject; items: ProjectActionItem[] }>();

    projectList.forEach((proj) => {
      const entry = { project: proj, items: [] };
      map.set(proj.id, entry);
      if (proj.caseNumber && proj.caseNumber.trim() && proj.caseNumber.trim().toUpperCase() !== 'POC') {
        caseNumberMap.set(proj.caseNumber.trim(), entry);
      }
    });

    filteredItems.forEach((item) => {
      let entry = map.get(item.projectId);
      if (!entry && item.projectCaseNumber && item.projectCaseNumber.trim() && item.projectCaseNumber.trim().toUpperCase() !== 'POC') {
        entry = caseNumberMap.get(item.projectCaseNumber.trim());
      }
      if (entry) {
        entry.items.push(item);
      } else {
        // 若此待辦所屬專案存在於系統專案名單中，表示該專案已被目前條件 (如已結案/類別/專案類型) 過濾，不可重新加入！
        const projectExists = projects.some(
          (p) => p.id === item.projectId || (p.caseNumber && item.projectCaseNumber && p.caseNumber.trim().toUpperCase() !== 'POC' && p.caseNumber.trim() === item.projectCaseNumber.trim())
        );
        if (!projectExists && selectedCategory === 'all' && selectedInternalStatus === 'all' && selectedSourceType === 'all') {
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

    // 關鍵排序：針對每個專案底下的待辦事項，確保「新增項目永遠放在最前面（最新在前）」
    map.forEach((group) => {
      group.items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    });

    const queryLower = searchQuery.trim().toLowerCase();

    // 3. 搜尋與空專案過濾
    const result = Array.from(map.values()).filter((group) => {
      // 專案本身是否符合搜尋關鍵字 (案名、案號、客戶名稱、PM、窗口、來源型態)
      const projectMatchesSearch = queryLower
        ? group.project.name.toLowerCase().includes(queryLower) ||
          (group.project.caseNumber && group.project.caseNumber.toLowerCase().includes(queryLower)) ||
          (group.project.clientName && group.project.clientName.toLowerCase().includes(queryLower)) ||
          (group.project.responsiblePm && group.project.responsiblePm.toLowerCase().includes(queryLower)) ||
          (group.project.clientContact && group.project.clientContact.toLowerCase().includes(queryLower)) ||
          (group.project.sourceType && group.project.sourceType.toLowerCase().includes(queryLower)) ||
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
    selectedSourceType,
    selectedClient,
    selectedPhase,
    selectedStatus,
    selectedWaitingOn,
    sortBy,
    hideEmptyProjects,
  ]);

  // 是否所有目前畫面上顯示的專案待辦項目都已收合 (需求3: 預設全部隱藏收合)
  const isAllCollapsed = useMemo(() => {
    if (groupedByProject.length === 0) return true;
    return groupedByProject.every((g) => {
      return collapsedProjects[g.project.id] !== undefined ? collapsedProjects[g.project.id] : true;
    });
  }, [groupedByProject, collapsedProjects]);

  // 一鍵切換：顯示/隱藏 所有專案待辦項目 (需求3)
  const toggleAllCollapse = () => {
    if (isAllCollapsed) {
      // 目前全部收合中 -> 一鍵顯示 (展開) 所有專案待辦
      const next: Record<string, boolean> = {};
      groupedByProject.forEach((g) => {
        next[g.project.id] = false;
      });
      projects.forEach((p) => {
        next[p.id] = false;
      });
      setCollapsedProjects(next);
    } else {
      // 目前有展開 -> 一鍵隱藏 (收合) 所有專案待辦
      const next: Record<string, boolean> = {};
      groupedByProject.forEach((g) => {
        next[g.project.id] = true;
      });
      projects.forEach((p) => {
        next[p.id] = true;
      });
      setCollapsedProjects(next);
    }
  };

  const toggleCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const current = prev[projectId] !== undefined ? prev[projectId] : true;
      return { ...prev, [projectId]: !current };
    });
  };

  const toggleShowCompleted = (projectId: string) => {
    setShowCompletedMap((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleSwitchToProjectView = (projectId: string) => {
    handleSetViewMode('project');
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: false }));
    setTimeout(() => {
      const el = document.getElementById(`project-${projectId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-blue-500', 'transition-all');
        setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2500);
      }
    }, 150);
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

  const handleOpenEditProject = (proj: FullProject) => {
    setProjectToEdit(proj);
    setEditProjectDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆待辦歷程嗎？此操作無法還原，關聯雲端附件亦將同步移除。\n\n🛡️ 安全保證：此操作僅刪除該筆內部待辦事項，【絕對不會】影響任何燁輝管制總表專案與週報紀錄！')) return;
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
    if (!isAdmin) {
      toast({
        title: '權限不足',
        description: '只有管理者才具備結案/勾選待辦事項的權限。',
        variant: 'destructive',
      });
      return;
    }
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
            let updatedCaseNumber = (res as any).data?.caseNumber !== undefined ? (res as any).data.caseNumber : p.caseNumber;
            if (payload.category === '已開案' && updatedCaseNumber) {
              updatedCaseNumber = updatedCaseNumber.replace(/^POC[\s\-_]*/i, '').trim();
            }
            const updatedEvaluationDate = (res as any).data?.evaluationDate !== undefined ? (res as any).data.evaluationDate : p.evaluationDate;
            const updatedKickoffDate = (res as any).data?.kickoffDate !== undefined ? (res as any).data.kickoffDate : (payload.category === '已開案' ? (p.kickoffDate || new Date().toISOString().slice(0, 10)) : p.kickoffDate);
            return {
              ...p,
              caseNumber: updatedCaseNumber,
              projectCategory: updatedCategory,
              internalStatus: updatedInternalStatus,
              evaluationDate: updatedEvaluationDate,
              kickoffDate: updatedKickoffDate,
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

  useEffect(() => {
    const handler = (e: any) => {
      const projId = e.detail?.projectId;
      const proj = projects.find((p) => p.id === projId);
      handleOpenAI(projId, proj?.name);
    };
    window.addEventListener('open-ai-diagnosis', handler);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ai') === 'open') {
        handleOpenAI();
      }
    }

    return () => window.removeEventListener('open-ai-diagnosis', handler);
  }, [projects]);

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

  // 渲染單一待辦事項列 (未完成與已完成共用，等候標籤依完成狀態自適應配色)
  const renderActionItemRow = (item: ProjectActionItem) => {
    const isDone = item.status === 'completed';
    const isBlocked = item.status === 'blocked';
    const today = new Date();
    const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
    const diffDays = dueDateObj
      ? differenceInCalendarDays(today, dueDateObj)
      : 0;
    const isOverdue = !isDone && dueDateObj && diffDays > 0;
    const isUpcoming = !isDone && dueDateObj && diffDays >= -3 && diffDays <= 0;

    // 工期計算（自動，無需人工維護）
    const startedAtObj = item.startedAt ? new Date(item.startedAt) : null;
    const completedAtObj = item.completedAt ? new Date(item.completedAt) : null;
    const workDays = startedAtObj
      ? differenceInCalendarDays(isDone && completedAtObj ? completedAtObj : today, startedAtObj)
      : null;
    const delayCount = item.dueDateHistory?.length || 0;
    const delayTotalDays = item.originalDueDate && item.dueDate && item.originalDueDate !== item.dueDate
      ? differenceInCalendarDays(new Date(item.dueDate), new Date(item.originalDueDate))
      : 0;

    return (
      <div
        key={item.id}
        id={`item-${item.id}`}
        className={`py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors ${
          isDone ? 'opacity-70' : ''
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

              {/* 責任歸屬 (客戶/單位) */}
              {item.owner && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                  <UserCheck className="h-3 w-3" />
                  責任歸屬: {item.owner}
                </span>
              )}

              {/* 附件數量標籤 */}
              {item.attachments && item.attachments.length > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] px-2 py-0.5 border-blue-200 bg-blue-50/80 text-blue-700 shadow-2xs font-normal"
                >
                  <Paperclip className="h-3 w-3 text-blue-600" />
                  {item.attachments.length} 個附件
                </Badge>
              )}
            </div>

            {/* 歷程說明 (需求1: 支援換行與上下滾動顯示) */}
            {(() => {
              const displayNotes = (item.notes || '').replace(/<!--ATTACHMENTS:[\s\S]*?-->/g, '').trim();
              if (!displayNotes) return null;
              return (
                <div className="text-xs text-slate-700 bg-slate-50/90 p-2.5 rounded-md border border-slate-200/80 leading-relaxed shadow-2xs">
                  <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1">
                    <span>📝 歷程說明：</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto pr-1 text-slate-600 select-text">
                    {displayNotes}
                  </div>
                </div>
              );
            })()}

            {/* Lesson Learnt 經驗檢討 (需求1: 支援換行與上下滾動顯示) */}
            {item.lessonLearnt && (
              <div className="text-xs text-amber-950 bg-amber-50/80 p-2.5 rounded-md border border-amber-200/80 leading-relaxed mt-2 shadow-2xs">
                <div className="font-semibold text-amber-950 mb-1 flex items-center gap-1">
                  <span>💡 經驗檢討 (Lesson Learnt)：</span>
                </div>
                <div className="whitespace-pre-wrap break-words max-h-40 overflow-y-auto pr-1 text-amber-900 select-text">
                  {item.lessonLearnt}
                </div>
              </div>
            )}

            {/* 雲端硬碟附件列表 */}
            {item.attachments && item.attachments.length > 0 && (
              <div className="text-xs bg-blue-50/50 p-2.5 rounded-md border border-blue-200/70 leading-relaxed mt-2 shadow-2xs">
                <div className="font-semibold text-blue-950 mb-1.5 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                  <span>雲端附件 ({item.attachments.length} 個檔案)：</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.attachments.map((att, idx) => {
                    const fileId = att.id || att.fileId || `att-${idx}`;
                    const viewUrl = att.webViewLink || att.webContentLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '#');
                    const isCopied = copiedFileId === fileId;
                    return (
                      <div
                        key={fileId}
                        className="inline-flex items-center rounded-md border border-blue-200/90 bg-white text-xs shadow-2xs overflow-hidden group hover:border-blue-400 transition-colors"
                      >
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-blue-700 hover:text-blue-900 hover:bg-blue-50/70 transition-colors"
                          title={`點擊於 Google Drive 開啟：${att.name}`}
                        >
                          <Paperclip className="h-3 w-3 text-blue-500 shrink-0" />
                          <span className="max-w-[170px] sm:max-w-[240px] truncate font-medium">{att.name}</span>
                          {att.size && att.size > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal shrink-0">
                              ({att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`})
                            </span>
                          )}
                          <ExternalLink className="h-2.5 w-2.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                        </a>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopyAttachmentLink(viewUrl, att.name, fileId);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 border-l border-blue-100 text-[11px] font-medium transition-colors ${
                            isCopied
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 bg-slate-50/50'
                          }`}
                          title="複製 Google 雲端硬碟分享連結，任何人無須權限皆可直接下載或檢視"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>已複製</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                              <span>複製連結</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
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
            <span className="text-xs text-muted-foreground">未設預計日</span>
          )}

          {/* 未設預計日但有工期資訊時仍顯示 */}
          {!item.dueDate && workDays !== null && workDays >= 0 && (
            <span className={`text-[11px] font-medium ${isDone ? 'text-slate-500' : 'text-blue-600'}`}>
              ⏱ {isDone ? `工期 ${workDays} 天` : `已執行 ${workDays} 天`}
            </span>
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
  };

  // 權限檢查：內部專案追蹤僅限內部成員 (管理者與協作編輯者) 檢視
  if (isLoaded && !isEditor) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 shadow-lg flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">需要登入系統</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            「內部專案與待辦追蹤」包含公司內部敏感情資與等候跟催歷程，僅開放給內部成員（管理者與協作編輯者）檢視。<br />
            請先登入帳號以進行存取。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Button
              onClick={() => setIsLoginDialogOpen(true)}
              className="gap-2 bg-primary text-white hover:bg-primary/90 text-xs"
            >
              <Lock className="w-4 h-4" />
              登入系統
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-slate-300 text-xs"
            >
              返回進度管制總表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* 頂部標題與行動列 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              內部專案管制與待辦歷程追蹤
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              內部管制專用
            </Badge>
            {!isAdmin && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium">
                👁️ 編輯者檢視模式 (唯讀)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            針對 50~70 個列管專案，即時掌握「等誰處理 (Waiting-on)」、「階段進程」、「跟催期限」與「AI 延誤診斷」。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={() => handleOpenAI()}
              variant="outline"
              className="gap-1.5 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-2xs font-semibold"
            >
              <Bot className="h-4 w-4 text-indigo-600" />
              🤖 AI 智慧診斷
            </Button>
          )}

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

      {/* 視圖切換器與快速選項 (需求2 方法1 + 需求4) */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between border-b pb-3 gap-3">
        {/* 左側：視圖切換 + 依視圖顯示的快速選項標籤 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 主視圖切換 */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleSetViewMode('project')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'project'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderGit2 className="h-4 w-4 text-slate-600" />
              <span>🗂️ 依專案分組檢視</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {projects.length} 案
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode('task')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'task'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>📋 待辦工作總覽</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  viewMode === 'task' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {actionItems.length} 項
              </span>
            </button>
          </div>

          <div className="hidden sm:block h-6 w-[1px] bg-slate-200 mx-1" />

          {/* 需求4: 依專案分組檢視時，在旁邊放置專案類別快速過濾，用不同顏色區隔 */}
          {viewMode === 'project' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                全部專案 ({categoryCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('評估案')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  selectedCategory === '評估案'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'text-purple-700 bg-purple-50/80 hover:bg-purple-100 border-purple-200'
                }`}
              >
                <span>📝 評估案 (POC)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedCategory === '評估案' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800'
                  }`}
                >
                  {categoryCounts.poc}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('已開案')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  selectedCategory === '已開案'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-blue-700 bg-blue-50/80 hover:bg-blue-100 border-blue-200'
                }`}
              >
                <span>🚀 已開案 (執行中)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedCategory === '已開案' ? 'bg-blue-700 text-white' : 'bg-blue-200 text-blue-800'
                  }`}
                >
                  {categoryCounts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('已結案')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  selectedCategory === '已結案'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200'
                }`}
              >
                <span>✅ 已結案</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedCategory === '已結案' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {categoryCounts.completed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('專案終止')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  selectedCategory === '專案終止'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'text-rose-700 bg-rose-50/80 hover:bg-rose-100 border-rose-200'
                }`}
              >
                <span>⛔ 專案終止</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedCategory === '專案終止' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-800'
                  }`}
                >
                  {categoryCounts.terminated}
                </span>
              </button>
            </div>
          )}

          {/* 需求2 方法1: 待辦工作總覽時，在旁邊放置待辦狀態快速選項，用不同顏色區隔 */}
          {viewMode === 'task' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTaskTab('all')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTaskTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                全部待辦 ({taskTabCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setActiveTaskTab('blocked')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  activeTaskTab === 'blocked'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'text-rose-700 bg-rose-50/80 hover:bg-rose-100 border-rose-200'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>🚨 卡關等候中</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTaskTab === 'blocked' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-800'
                  }`}
                >
                  {taskTabCounts.blocked}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTaskTab('overdue')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  activeTaskTab === 'overdue'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'text-amber-700 bg-amber-50/80 hover:bg-amber-100 border-amber-200'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>⚠️ 逾期/到期</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTaskTab === 'overdue' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-800'
                  }`}
                >
                  {taskTabCounts.overdue}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTaskTab('active')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  activeTaskTab === 'active'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-blue-700 bg-blue-50/80 hover:bg-blue-100 border-blue-200'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>🔄 處理中/待辦</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTaskTab === 'active' ? 'bg-blue-700 text-white' : 'bg-blue-200 text-blue-800'
                  }`}
                >
                  {taskTabCounts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTaskTab('completed')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  activeTaskTab === 'completed'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>✅ 已完成</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTaskTab === 'completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {taskTabCounts.completed}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 右側：動作按鈕與工具 */}
        <div className="flex items-center gap-2 self-end xl:self-auto shrink-0">
          {viewMode === 'project' ? (
            <>
              <div className="flex items-center gap-1.5">
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-white">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-slate-500" />
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
                variant="outline"
                size="sm"
                onClick={toggleAllCollapse}
                className={`h-8 text-xs gap-1.5 font-medium transition-all cursor-pointer ${
                  isAllCollapsed
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'text-slate-700 bg-white hover:bg-slate-50'
                }`}
                title="一鍵展開或隱藏所有專案底下的待辦事項明細"
              >
                {isAllCollapsed ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                    <span>顯示所有專案待辦項目</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                    <span>隱藏所有專案待辦項目</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            isAdmin && (
              <Button
                size="sm"
                onClick={() => handleOpenAdd()}
                className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>新增待辦事項</span>
              </Button>
            )
          )}
        </div>
      </div>

      {viewMode === 'task' ? (
        <TaskCentricView
          items={actionItems}
          projects={projects}
          users={users}
          clients={clients}
          isAdmin={isAdmin}
          onEditItem={handleOpenEdit}
          onDeleteItem={handleDelete}
          onToggleComplete={handleQuickToggleComplete}
          onAddNewItem={(projId) => handleOpenAdd(projId)}
          onSwitchToProjectView={handleSwitchToProjectView}
          uniqueWaitingOns={uniqueWaitingOns}
          activeTab={activeTaskTab}
          onTabChange={setActiveTaskTab}
        />
      ) : (
        <>

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
          {/* 客戶篩選 */}
          <Select value={selectedClient} onValueChange={(val: any) => setSelectedClient(val)}>
            <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
              <SelectValue placeholder="全部客戶" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部客戶 ({projects.length})</SelectItem>
              {clientFilterOptions.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  🏢 {c.name} ({c.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 專案來源型態篩選 */}
          <Select value={selectedSourceType} onValueChange={(val: any) => setSelectedSourceType(val)}>
            <SelectTrigger className="w-[165px] h-9 text-xs font-medium">
              <SelectValue placeholder="專案來源型態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部來源型態 ({projects.length})</SelectItem>
              <SelectItem value="燁輝列管專案">🏢 燁輝列管專案</SelectItem>
              <SelectItem value="億威內部自建專案">🏭 億威自建專案</SelectItem>
              <SelectItem value="其他專案">⚙️ 其他專案</SelectItem>
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

          {/* 待處理者 (等候對象) 篩選 */}
          <Select value={selectedWaitingOn} onValueChange={setSelectedWaitingOn}>
            <SelectTrigger className={`w-[145px] h-9 text-xs transition-colors ${selectedWaitingOn !== 'all' ? 'border-rose-400 bg-rose-50/50 text-rose-950 font-bold' : ''}`}>
              <SelectValue placeholder="篩選待處理者" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">全部待處理者</SelectItem>
              {uniqueWaitingOns.map((party) => (
                <SelectItem key={party} value={party} className="text-xs">
                  等候: {party}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchQuery || selectedCategory !== 'all' || selectedInternalStatus !== 'all' || selectedSourceType !== 'all' || selectedClient !== 'all' || selectedPhase !== 'all' || selectedStatus !== 'all' || selectedWaitingOn !== 'all' || hideEmptyProjects) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedInternalStatus('all');
                setSelectedSourceType('all');
                setSelectedClient('all');
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
            const isCollapsed = collapsedProjects[project.id] !== undefined ? collapsedProjects[project.id] : true;
            const activeItems = items.filter((i) => i.status !== 'completed');
            const completedItems = items.filter((i) => i.status === 'completed');
            const isCompletedExpanded = !!showCompletedMap[project.id];
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

            const projExpectedDate = project.expectedCompletionDate ? new Date(project.expectedCompletionDate) : null;
            const projDiffDays = projExpectedDate ? differenceInCalendarDays(new Date(), projExpectedDate) : 0;
            const isProjOverdue = !isCompleted && projExpectedDate && projDiffDays > 0;
            const isProjUpcoming = !isCompleted && projExpectedDate && projDiffDays >= -7 && projDiffDays <= 0;

            return (
              <div
                key={project.id}
                id={`project-${project.id}`}
                className={`rounded-lg border transition-all overflow-hidden ${
                  highlightedProjectId === project.id
                    ? 'ring-4 ring-indigo-500 ring-offset-2 border-indigo-500 shadow-xl'
                    : isCompleted
                    ? 'border-emerald-300 bg-emerald-50/50 shadow-sm'
                    : isTerminated
                    ? 'border-rose-300 bg-rose-50/50 shadow-sm'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                {/* 專案卡片標頭 */}
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between px-3.5 py-2.5 border-b gap-2.5 ${
                  highlightedProjectId === project.id
                    ? 'bg-indigo-50/60 border-indigo-200'
                    : isCompleted
                    ? 'bg-emerald-100/70 border-emerald-200/90'
                    : isTerminated
                    ? 'bg-rose-100/70 border-rose-200/90'
                    : 'bg-white border-slate-100'
                }`}>
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleCollapse(project.id)}
                      className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-600 shrink-0"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* 案號 */}
                      {project.caseNumber && (
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                          {project.caseNumber}
                        </span>
                      )}

                      {/* 專案來源型態標籤 (置於名稱前) */}
                      {project.sourceType === '億威內部自建專案' ? (
                        <Badge className="bg-purple-700 hover:bg-purple-800 text-white text-[11px] px-1.5 py-0.5 shadow-2xs flex items-center gap-1 shrink-0">
                          <span>🏭 億威自建</span>
                        </Badge>
                      ) : (project.sourceType === '其他專案' || project.sourceType === '其他智慧製造專案') ? (
                        <Badge className="bg-teal-700 hover:bg-teal-800 text-white text-[11px] px-1.5 py-0.5 shadow-2xs flex items-center gap-1 shrink-0">
                          <span>⚙️ 其他專案</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-700 hover:bg-blue-800 text-white text-[11px] px-1.5 py-0.5 shadow-2xs flex items-center gap-1 shrink-0">
                          <span>🏢 燁輝列管</span>
                        </Badge>
                      )}

                      {/* 專案類別標籤 (開案狀態，置於名稱前) */}
                      {isEvalCategory ? (
                        <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] px-1.5 py-0.5 shadow-xs flex items-center gap-1 shrink-0">
                          <span>📝 評估案</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-1.5 py-0.5 shadow-xs flex items-center gap-1 shrink-0">
                          <span>🚀 已開案</span>
                        </Badge>
                      )}

                      {/* 評估歷時 / 評估天數統計徽章 */}
                      {(() => {
                        const evalDate = project.evaluationDate;
                        if (!evalDate) return null;
                        if (isEvalCategory) {
                          const diffMs = Date.now() - new Date(evalDate).getTime();
                          const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                          return (
                            <span
                              className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shadow-2xs shrink-0"
                              title={`評估起始日期：${evalDate} (至今已持續評估 ${days} 天)`}
                            >
                              <Clock className="h-3 w-3 text-purple-600" />
                              <span>評估中 {days}天</span>
                            </span>
                          );
                        } else {
                          const endMs = project.kickoffDate ? new Date(project.kickoffDate).getTime() : Date.now();
                          const diffMs = endMs - new Date(evalDate).getTime();
                          const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                          return (
                            <span
                              className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shadow-2xs shrink-0"
                              title={`評估起始：${evalDate} ➔ 轉已開案：${project.kickoffDate || '已開案'} (評估歷時共 ${days} 天)`}
                            >
                              <Clock className="h-3 w-3 text-emerald-600" />
                              <span>評估耗時 {days}天</span>
                            </span>
                          );
                        }
                      })()}

                      {/* 專案名稱 */}
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 mr-1">{project.name}</h2>

                      {/* 鎖定目標提示標籤 */}
                      {highlightedProjectId === project.id && (
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] px-2 py-0.5 shadow-sm animate-pulse flex items-center gap-1 shrink-0">
                          🎯 目標鎖定專案
                        </Badge>
                      )}

                      {/* 客戶名稱標籤 */}
                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-[11px] px-1.5 py-0.5 flex items-center gap-1 font-medium shadow-2xs shrink-0">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        <span>客戶: {project.clientName || '燁輝'}</span>
                      </Badge>

                      {/* 關聯客戶管制表標籤 */}
                      {project.linkedCustomerProjectId && (
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                          <span>🔗 已連結</span>
                        </Badge>
                      )}

                      {/* 負責 PM 與 客戶窗口 */}
                      {(project.responsiblePm || project.tpmOfficeContact) && (
                        <span className="text-[11px] text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shadow-2xs shrink-0">
                          <UserCheck className="h-3 w-3 text-slate-500" />
                          PM: {project.responsiblePm || project.tpmOfficeContact}
                        </span>
                      )}

                      {(project.clientContact || project.yiehPhuiProjectManager) && (
                        <span className="text-[11px] text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shadow-2xs shrink-0">
                          <Users className="h-3 w-3 text-slate-500" />
                          窗口: {project.clientContact || project.yiehPhuiProjectManager}
                        </span>
                      )}

                      {/* 專案目標完成日 (整合至同一行) */}
                      {project.expectedCompletionDate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="flex items-center gap-1 text-[11px] text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300 font-medium shadow-2xs">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            目標: {project.expectedCompletionDate}
                          </span>
                          {!isCompleted && isProjOverdue && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 bg-rose-600 font-semibold shadow-2xs">
                              🚨 逾期 {projDiffDays}天
                            </Badge>
                          )}
                          {!isCompleted && isProjUpcoming && (
                            <Badge className="text-[10px] px-1 py-0 bg-amber-500 text-white font-medium shadow-2xs">
                              ⏳ 剩 {Math.abs(projDiffDays)}天
                            </Badge>
                          )}
                          {!isCompleted && projExpectedDate && !isProjOverdue && !isProjUpcoming && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              (剩 {Math.abs(projDiffDays)}天)
                            </span>
                          )}
                        </div>
                      )}

                      {/* 待辦統計徽章 (整合至同一行) */}
                      <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-medium shrink-0">
                        待辦 {items.length}項
                      </span>
                      {blockedItems.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-rose-300 bg-rose-50 text-rose-600 font-medium shrink-0">
                          <AlertCircle className="h-3 w-3 mr-0.5" />
                          {blockedItems.length}項卡關
                        </Badge>
                      )}
                      {overdueItems.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 bg-amber-50 text-amber-600 font-medium shrink-0">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          {overdueItems.length}項逾期
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 專案右側操作按鈕 (已移除個別 AI 診斷按鈕) */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-auto flex-wrap">
                    {/* 管理員專案狀態生命週期變更與編輯 */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {/* 編輯專案設定 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditProject(project)}
                          className="gap-1 text-xs h-8 text-slate-700 bg-white hover:bg-slate-100 shadow-2xs font-medium"
                          title="編輯專案名稱、案號、狀態與預估完成日"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-indigo-600" />
                          編輯專案
                        </Button>

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
                            <DropdownMenuItem
                              onClick={() => handleOpenEditProject(project)}
                              className="cursor-pointer py-1.5 text-indigo-700 focus:text-indigo-800 focus:bg-indigo-50"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-indigo-600 mr-2" />
                              編輯專案設定與期限
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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

                {/* 待辦事項清單 (分層架構：未完成直接展示，已完成可收合) */}
                {!isCollapsed && (
                  <div className={`p-4 space-y-2.5 ${
                    isCompleted ? 'bg-emerald-50/20' : isTerminated ? 'bg-rose-50/20' : 'bg-white'
                  }`}>
                    {items.length === 0 ? (
                      <div className={`py-6 text-center text-xs rounded border border-dashed ${
                        isCompleted
                          ? 'text-emerald-800/80 bg-emerald-50/40 border-emerald-200'
                          : isTerminated
                          ? 'text-rose-800/80 bg-rose-50/40 border-rose-200'
                          : 'text-muted-foreground bg-slate-50/40 border-slate-200'
                      }`}>
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
                      <>
                        {/* 次層 1：未完成待辦事項 (不用縮放，直接一目了然條列) */}
                        {activeItems.length === 0 ? (
                          <div className="py-2.5 px-3 text-center text-xs rounded bg-slate-50 border border-slate-200/70 text-slate-500 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>目前無未完成事項，所有待辦皆已全數結清。</span>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {activeItems.map((item) => renderActionItemRow(item))}
                          </div>
                        )}

                        {/* 次層 2：已完成待辦事項 (可以再縮一次，預設收合，點擊切換展開/隱藏) */}
                        {completedItems.length > 0 && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => toggleShowCompleted(project.id)}
                              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 transition-colors cursor-pointer select-none"
                            >
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>已完成事項 ({completedItems.length} 項)</span>
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                                {isCompletedExpanded ? '點擊收合' : '點擊展開查看'}
                                {isCompletedExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                )}
                              </span>
                            </button>

                            {isCompletedExpanded && (
                              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200/60 bg-slate-50/50 px-3 py-1">
                                {completedItems.map((item) => renderActionItemRow(item))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </>
      )}

      {/* 待辦事項彈窗 */}
      <ActionItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        defaultProjectId={defaultProjectId}
        projects={projects}
        users={users}
        clients={clients}
        actionItems={actionItems}
        onSuccess={(savedItem) => {
          if (savedItem) {
            const targetProj = projects.find((p) => p.id === savedItem.projectId);
            const enrichedItem: ProjectActionItem = {
              ...savedItem,
              projectName: savedItem.projectName || targetProj?.name || '',
              projectCaseNumber: savedItem.projectCaseNumber || targetProj?.caseNumber || '',
              projectCategory: savedItem.projectCategory || targetProj?.projectCategory || ((targetProj?.status as any) === 'poc' ? '評估案' : '已開案'),
            };

            if (editingItem) {
              setActionItems((prev) =>
                prev.map((i) => (i.id === savedItem.id ? { ...i, ...enrichedItem } : i))
              );
            } else {
              // 新增項目：永遠放在最前面！
              setActionItems((prev) => [enrichedItem, ...prev.filter((i) => i.id !== savedItem.id)]);
              // 自動展開所屬專案
              setCollapsedProjects((prev) => ({ ...prev, [savedItem.projectId]: false }));
            }

            // 背景更新伺服端快取 (不重整頁面，不遺失目前捲動軸位置)
            router.refresh();

            // 平滑定位到該專案或待辦項目，保持畫面視角不跳回頂部
            setTimeout(() => {
              const targetEl =
                document.getElementById(`item-${savedItem.id}`) ||
                document.getElementById(`task-item-${savedItem.id}`) ||
                document.getElementById(`project-${savedItem.projectId}`);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 100);
          }
        }}
      />

      {/* 新增內部專案 (POC) 彈窗 */}
      <NewPocProjectDialog
        open={pocDialogOpen}
        onOpenChange={setPocDialogOpen}
        users={users}
        clients={clients}
        onSuccess={(newProj) => {
          if (newProj) {
            setProjects((prev) => [newProj, ...prev.filter((p) => p.id !== newProj.id)]);
            setCollapsedProjects((prev) => ({ ...prev, [newProj.id]: false }));
            setTimeout(() => {
              const el = document.getElementById(`project-${newProj.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 250);
          }
          router.refresh();
        }}
      />

      {/* 編輯內部專案彈窗 */}
      <EditInternalProjectDialog
        open={editProjectDialogOpen}
        onOpenChange={(open) => {
          setEditProjectDialogOpen(open);
          if (!open) {
            setProjectToEdit(null);
            setTimeout(() => {
              document.body.style.pointerEvents = '';
              document.body.style.overflow = '';
            }, 50);
          }
        }}
        project={projectToEdit}
        users={users}
        clients={clients}
        onSuccess={(updatedData) => {
          setProjects((prev) =>
            prev.map((p) => {
              if (p.id !== updatedData.id) return p;
              return {
                ...p,
                ...updatedData,
              };
            })
          );
        }}
        onDeleted={(deletedProjectId) => {
          setProjects((prev) => prev.filter((p) => p.id !== deletedProjectId));
          setActionItems((prev) => prev.filter((item) => item.projectId !== deletedProjectId));
          setProjectToEdit(null);
          setEditProjectDialogOpen(false);
          router.refresh();

          setTimeout(() => {
            document.body.style.pointerEvents = '';
            document.body.style.overflow = '';
          }, 50);
        }}
        onActionItemsCleared={(clearedProjectId) => {
          setActionItems((prev) => prev.filter((item) => item.projectId !== clearedProjectId));
          router.refresh();
        }}
      />

      {/* AI 分析彈窗 */}
      <AIAnalysisDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        projectId={aiTargetProjectId}
        projectName={aiTargetProjectName}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          caseNumber: p.caseNumber,
          category: p.projectCategory || ((p as any).status === 'poc' ? '評估案' : '已開案'),
          status: p.status,
        }))}
      />
    </div>
  );
}
