'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  format,
  parseISO,
  isValid,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  isAfter,
} from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  BarChart2,
  Info,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/components/admin-context';
import { EditPhaseScheduleDialog } from './edit-phase-schedule-dialog';
import { ActionItemDialog } from '@/components/internal/action-item-dialog';
import {
  MAJOR_PHASES,
  MajorPhaseKey,
  getMajorPhaseKey,
} from '@/lib/phase-constants';
import type {
  FullProject,
  ProjectActionItem,
  ProjectPhaseSchedules,
  User,
  Client,
} from '@/types';

interface ProjectVarianceClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
  users?: User[];
  clients?: Client[];
}

export interface ResolvedActionItem extends ProjectActionItem {
  resolvedStart: string;
  resolvedEnd: string;
  durationDays: number;
  elapsedDays: number;
  isItemDelayed: boolean;
}

export function ProjectVarianceClient({
  initialProjects,
  initialActionItems,
  users = [],
  clients = [],
}: ProjectVarianceClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { permissions, isLoaded, setIsLoginDialogOpen } = useAdmin();

  const [projects, setProjects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  // 專案篩選與選中專案
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (initialProjects.length === 0) return '';
    // 優先選中有設定自訂階段時程的專案（如 [33] 屏東廠空氣品質即時監測系統）或第一個專案
    const withSchedule = initialProjects.find(
      (p) =>
        p.phaseSchedules &&
        (p.phaseSchedules.design?.startDate ||
          p.phaseSchedules.construction?.startDate ||
          p.phaseSchedules.verification?.startDate ||
          p.phaseSchedules.acceptance?.startDate)
    );
    if (withSchedule) return withSchedule.id;
    const found = initialProjects.find(
      (p) => p.name.includes('屏東廠空氣品質') || p.name.includes('烤一線') || p.name.includes('顯性缺陷')
    );
    return found ? found.id : initialProjects[0].id;
  });

  const [clientFilter, setClientFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // 摺疊控制：專案摺疊狀態、四大階段摺疊狀態
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    [selectedProjectId]: true,
  });
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    [`${selectedProjectId}-design`]: false,
    [`${selectedProjectId}-construction`]: false,
    [`${selectedProjectId}-verification`]: true,
    [`${selectedProjectId}-acceptance`]: false,
  });

  // 當切換專案時，預設展開含有待辦事項之驗證階段，方便直接檢視細項與天數
  useEffect(() => {
    if (!selectedProjectId) return;
    setExpandedProjects((prev) => ({ ...prev, [selectedProjectId]: true }));
    setExpandedPhases((prev) => ({
      ...prev,
      [`${selectedProjectId}-verification`]:
        prev[`${selectedProjectId}-verification`] ?? true,
    }));
  }, [selectedProjectId]);

  // Dialog 控制
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddActionItemOpen, setIsAddActionItemOpen] = useState(false);
  const [editingActionItem, setEditingActionItem] = useState<ProjectActionItem | null>(null);

  // 篩選後的主專案列表
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchClient =
        clientFilter === 'all' || (p.clientName || '燁輝') === clientFilter;
      const matchCat =
        categoryFilter === 'all' || (p.projectCategory || '已開案') === categoryFilter;
      return matchClient && matchCat;
    });
  }, [projects, clientFilter, categoryFilter]);

  // 當前選中的主專案
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || filteredProjects[0] || null;
  }, [projects, selectedProjectId, filteredProjects]);

  // 今日基準日期
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  // 取得專案的四大階段規劃時程 (若無，提供合理預設排程)
  const getProjectPhaseSchedules = (
    proj: FullProject
  ): {
    schedules: Record<MajorPhaseKey, { startDate: string; endDate: string }>;
    isDefault: boolean;
  } => {
    const curYear = today.getFullYear();
    const ps = proj.phaseSchedules || {};

    const hasCustom =
      !!ps.design?.startDate ||
      !!ps.construction?.startDate ||
      !!ps.verification?.startDate ||
      !!ps.acceptance?.startDate;

    const schedules: Record<MajorPhaseKey, { startDate: string; endDate: string }> = {
      design: {
        startDate: ps.design?.startDate || `${curYear}-06-01`,
        endDate: ps.design?.endDate || `${curYear}-07-31`,
      },
      construction: {
        startDate: ps.construction?.startDate || `${curYear}-08-01`,
        endDate: ps.construction?.endDate || `${curYear}-09-30`,
      },
      verification: {
        startDate: ps.verification?.startDate || `${curYear}-10-01`,
        endDate: ps.verification?.endDate || `${curYear}-11-15`,
      },
      acceptance: {
        startDate: ps.acceptance?.startDate || `${curYear}-11-16`,
        endDate: ps.acceptance?.endDate || `${curYear}-12-31`,
      },
    };

    return { schedules, isDefault: !hasCustom };
  };

  /**
   * 智慧解析單一待辦事項的實質起訖日期與完成天數：
   * 解決歷史追補建檔 (createdAt 晚於 completedAt 或 originalDueDate) 導致所有 Bar 擠在同一天或寬度異常的問題，
   * 確保原始規劃項目與後續新增執行方案依真實時間前後順序排列。
   */
  const resolveActionItemTimeline = (
    item: ProjectActionItem,
    phasePlan: { startDate: string; endDate: string }
  ): ResolvedActionItem => {
    const compStr = item.completedAt ? item.completedAt.slice(0, 10) : null;
    const dueStr = item.dueDate ? item.dueDate.slice(0, 10) : null;
    const origDueStr = item.originalDueDate ? item.originalDueDate.slice(0, 10) : dueStr;
    const startedStr = item.startedAt ? item.startedAt.slice(0, 10) : null;
    const createdStr = item.createdAt ? item.createdAt.slice(0, 10) : todayStr;
    const updatedStr = item.updatedAt ? item.updatedAt.slice(0, 10) : todayStr;

    // 1. 決定結束日期 (resolvedEnd)
    let resolvedEnd = todayStr;
    if (item.status === 'completed') {
      resolvedEnd = compStr || dueStr || updatedStr || todayStr;
    } else {
      // 未完成項目：若有預計完成日且晚於今日，延伸至預計完成日；若已逾期則延伸至今日或預計完成日較晚者
      if (dueStr) {
        resolvedEnd = dueStr > todayStr ? dueStr : todayStr;
      } else {
        resolvedEnd = todayStr;
      }
    }

    // 2. 決定開始日期 (resolvedStart)
    let resolvedStart = createdStr;
    if (startedStr && startedStr <= resolvedEnd) {
      resolvedStart = startedStr;
    } else {
      // 若無明確 startedAt，檢查是否為事後補登之歷史項目 (createdStr 晚於完成日或最初到期基準日)
      const isRetroactiveEntry =
        createdStr > resolvedEnd || (origDueStr !== null && createdStr > origDueStr);

      if (isRetroactiveEntry) {
        if (origDueStr && origDueStr < resolvedEnd && origDueStr > phasePlan.endDate) {
          // 例如：驗證階段後續新增的早期執行方案 (origDue: 2026-01-30, completed: 2026-07-02)
          resolvedStart = origDueStr;
        } else if (phasePlan.startDate && phasePlan.startDate <= resolvedEnd) {
          // 例如：於原規劃階段內完成的項目 (施工階段 2025-08-04 ~ 2025-09-10)
          resolvedStart = phasePlan.startDate;
        } else if (origDueStr && origDueStr <= resolvedEnd) {
          resolvedStart = origDueStr;
        } else {
          resolvedStart = resolvedEnd;
        }
      } else {
        resolvedStart = createdStr <= resolvedEnd ? createdStr : resolvedEnd;
      }
    }

    const startObj = parseISO(resolvedStart);
    const endObj = parseISO(resolvedEnd);
    const durationDays =
      isValid(startObj) && isValid(endObj)
        ? Math.max(1, differenceInDays(endObj, startObj) + 1)
        : 1;

    const elapsedDays =
      isValid(startObj)
        ? Math.max(1, differenceInDays(today, startObj) + 1)
        : durationDays;

    const isItemDelayed = Boolean(
      (item.status !== 'completed' && dueStr && isAfter(today, parseISO(dueStr))) ||
        (phasePlan.endDate && resolvedEnd && isAfter(parseISO(resolvedEnd), parseISO(phasePlan.endDate)))
    );

    return {
      ...item,
      resolvedStart,
      resolvedEnd,
      durationDays,
      elapsedDays,
      isItemDelayed,
    };
  };

  // 取得專案某一階段的實際執行起訖 (依據待辦事項，並按時間前後順序排列)
  const getActualPhaseProgress = (
    projectId: string,
    phaseKey: MajorPhaseKey,
    phasePlan: { startDate: string; endDate: string }
  ) => {
    const rawItems = actionItems.filter(
      (item) => item.projectId === projectId && getMajorPhaseKey(item.phase) === phaseKey
    );

    if (rawItems.length === 0) {
      return {
        hasItems: false,
        items: [] as ResolvedActionItem[],
        actualStart: null as string | null,
        actualEnd: null as string | null,
        actualDays: null as number | null,
        isCompleted: false,
        completedCount: 0,
        totalCount: 0,
      };
    }

    // 解析每個待辦的實質起訖與天數，並依完成/結束時間與起始時間先後順序 (前後順序) 排序
    const resolvedItems = rawItems
      .map((item) => resolveActionItemTimeline(item, phasePlan))
      .sort((a, b) => {
        if (a.resolvedEnd !== b.resolvedEnd) {
          return a.resolvedEnd.localeCompare(b.resolvedEnd);
        }
        if (a.resolvedStart !== b.resolvedStart) {
          return a.resolvedStart.localeCompare(b.resolvedStart);
        }
        const dueA = a.dueDate || '';
        const dueB = b.dueDate || '';
        return dueA.localeCompare(dueB);
      });

    const completedCount = resolvedItems.filter((i) => i.status === 'completed').length;
    const isCompleted = completedCount === resolvedItems.length && resolvedItems.length > 0;

    const allStarts = resolvedItems.map((i) => i.resolvedStart).sort();
    const allEnds = resolvedItems.map((i) => i.resolvedEnd).sort();

    const actualStart = allStarts[0] || null;
    let actualEnd = allEnds[allEnds.length - 1] || null;

    if (!isCompleted && actualEnd && actualEnd < todayStr) {
      actualEnd = todayStr;
    }

    const actualDays =
      actualStart && actualEnd
        ? Math.max(1, differenceInDays(parseISO(actualEnd), parseISO(actualStart)) + 1)
        : null;

    return {
      hasItems: true,
      items: resolvedItems,
      actualStart,
      actualEnd,
      actualDays,
      isCompleted,
      completedCount,
      totalCount: resolvedItems.length,
    };
  };

  // 當前選中專案的四大階段分析資料
  const currentAnalysis = useMemo(() => {
    if (!currentProject) return null;

    const { schedules, isDefault } = getProjectPhaseSchedules(currentProject);

    const phasesData = MAJOR_PHASES.map((p) => {
      const plan = schedules[p.key];
      const actual = getActualPhaseProgress(currentProject.id, p.key, plan);

      const planDays =
        plan.startDate && plan.endDate
          ? Math.max(1, differenceInDays(parseISO(plan.endDate), parseISO(plan.startDate)) + 1)
          : 0;

      // 計算差異 (天數)：正數代表延誤，負數代表提前
      let varianceDays: number | null = null;
      let statusText = '尚未啟動';
      let statusVariant: 'default' | 'success' | 'warning' | 'destructive' = 'default';

      if (actual.actualStart && plan.startDate) {
        const startDiff = differenceInDays(parseISO(actual.actualStart), parseISO(plan.startDate));
        if (actual.isCompleted && actual.actualEnd && plan.endDate) {
          const endDiff = differenceInDays(parseISO(actual.actualEnd), parseISO(plan.endDate));
          varianceDays = endDiff;
          if (endDiff <= 0) {
            statusText = endDiff === 0 ? '如期完成' : `提前 ${Math.abs(endDiff)} 天完成`;
            statusVariant = 'success';
          } else {
            statusText = `延誤 ${endDiff} 天完成`;
            statusVariant = 'destructive';
          }
        } else {
          // 進行中
          const planEnd = parseISO(plan.endDate);
          const refEnd = actual.actualEnd ? parseISO(actual.actualEnd) : today;
          const checkDate = isAfter(today, refEnd) ? today : refEnd;
          const isOverdue = isAfter(checkDate, planEnd);
          if (isOverdue) {
            const overdueDays = differenceInDays(today, planEnd);
            statusText = `逾期進行中 (+${Math.max(1, overdueDays)}天)`;
            statusVariant = 'destructive';
            varianceDays = Math.max(1, overdueDays);
          } else {
            statusText = `正常進行中 (${actual.completedCount}/${actual.totalCount}完成)`;
            statusVariant = 'warning';
            varianceDays = startDiff;
          }
        }
      }

      return {
        ...p,
        plan,
        planDays,
        actual,
        varianceDays,
        statusText,
        statusVariant,
      };
    });

    // 專案整體總起訖 (依原始規劃日期)
    const allPlanStarts = phasesData
      .map((p) => p.plan.startDate)
      .filter(Boolean)
      .sort();
    const allPlanEnds = phasesData
      .map((p) => p.plan.endDate)
      .filter(Boolean)
      .sort();

    const projectPlanStart = allPlanStarts[0] || null;
    const projectPlanEnd = allPlanEnds[allPlanEnds.length - 1] || null;
    const projectPlanDays =
      projectPlanStart && projectPlanEnd
        ? Math.max(1, differenceInDays(parseISO(projectPlanEnd), parseISO(projectPlanStart)) + 1)
        : 0;

    return {
      project: currentProject,
      isDefault,
      projectPlanStart,
      projectPlanEnd,
      projectPlanDays,
      phasesData,
    };
  }, [currentProject, actionItems, today, todayStr]);

  /**
   * 動態依專案「原始規劃起始日」至「最新實際執行方案 / 今日」產生時間軸月份列表
   * 確保原始四大階段呈現階梯式前後順序，且後續新的執行方案完整顯示在後面！
   */
  const timelineMonths = useMemo(() => {
    const curYear = today.getFullYear();
    const dateCandidates: Date[] = [today];

    if (currentAnalysis) {
      currentAnalysis.phasesData.forEach((p) => {
        if (p.plan.startDate) {
          const d = parseISO(p.plan.startDate);
          if (isValid(d)) dateCandidates.push(d);
        }
        if (p.plan.endDate) {
          const d = parseISO(p.plan.endDate);
          if (isValid(d)) dateCandidates.push(d);
        }
        if (p.actual.actualStart) {
          const d = parseISO(p.actual.actualStart);
          if (isValid(d)) dateCandidates.push(d);
        }
        if (p.actual.actualEnd) {
          const d = parseISO(p.actual.actualEnd);
          if (isValid(d)) dateCandidates.push(d);
        }
        p.actual.items.forEach((item) => {
          const ds = parseISO(item.resolvedStart);
          const de = parseISO(item.resolvedEnd);
          if (isValid(ds)) dateCandidates.push(ds);
          if (isValid(de)) dateCandidates.push(de);
        });
      });
    }

    if (dateCandidates.length === 0) {
      const start = new Date(curYear, 4, 1);
      return Array.from({ length: 9 }, (_, i) => addMonths(start, i));
    }

    const timestamps = dateCandidates.map((d) => d.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const startMonth = startOfMonth(minDate);
    // 結尾預留 1 個月緩衝，讓 Bar 後方的「完成天數」標籤有充裕空間顯示
    const targetEndMonth = startOfMonth(addMonths(maxDate, 1));

    const months: Date[] = [];
    let cursor = startMonth;
    while (cursor.getTime() <= targetEndMonth.getTime() && months.length < 36) {
      months.push(cursor);
      cursor = addMonths(cursor, 1);
    }

    while (months.length < 9) {
      months.push(addMonths(months[months.length - 1], 1));
    }

    return months;
  }, [currentAnalysis, today]);

  // 依據總月數自動調整單月欄寬，兼顧跨年度全貌與日期比例清晰度
  const monthWidth = useMemo(() => {
    if (timelineMonths.length > 16) return 86;
    if (timelineMonths.length > 12) return 96;
    return 110;
  }, [timelineMonths.length]);

  const timelineStart = useMemo(
    () => startOfMonth(timelineMonths[0]),
    [timelineMonths]
  );
  const timelineEnd = useMemo(
    () => endOfMonth(timelineMonths[timelineMonths.length - 1]),
    [timelineMonths]
  );
  const totalTimelineDays = useMemo(
    () => Math.max(1, differenceInDays(timelineEnd, timelineStart) + 1),
    [timelineStart, timelineEnd]
  );

  const totalTimelineWidth = timelineMonths.length * monthWidth;

  // 計算任何日期在時間軸上的像素位置
  const getXForDate = (dateVal: string | Date | null | undefined): number | null => {
    if (!dateVal) return null;
    const d = typeof dateVal === 'string' ? parseISO(dateVal) : dateVal;
    if (!isValid(d)) return null;

    const diff = differenceInDays(d, timelineStart);
    const ratio = diff / totalTimelineDays;
    return Math.max(0, Math.min(totalTimelineWidth, ratio * totalTimelineWidth));
  };

  // 計算今日線位置
  const todayX = useMemo(() => {
    return getXForDate(today);
  }, [today, timelineStart, totalTimelineDays, totalTimelineWidth]);

  // 儲存規劃時程回調
  const handleScheduleSaved = (updatedSchedules: ProjectPhaseSchedules) => {
    if (!currentProject) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProject.id
          ? { ...p, phaseSchedules: updatedSchedules }
          : p
      )
    );
  };

  // 待辦儲存回調
  const handleActionItemSaved = (newItem?: ProjectActionItem) => {
    if (!newItem) return;
    setActionItems((prev) => {
      const idx = prev.findIndex((i) => i.id === newItem.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newItem;
        return copy;
      }
      return [newItem, ...prev];
    });
  };

  // 季度分組輔助 (區分年份避免跨年同季度合併)
  const quarterGroups = useMemo(() => {
    const groups: { key: string; label: string; colSpan: number }[] = [];
    timelineMonths.forEach((m) => {
      const monthNum = m.getMonth() + 1; // 1-12
      let qName = '';
      if (monthNum <= 3) qName = '第一季';
      else if (monthNum <= 6) qName = '第二季';
      else if (monthNum <= 9) qName = '第三季';
      else qName = '第四季';

      const year = m.getFullYear();
      const key = `${year}-${qName}`;
      const label = `${year}年 ${qName}`;

      if (groups.length > 0 && groups[groups.length - 1].key === key) {
        groups[groups.length - 1].colSpan += 1;
      } else {
        groups.push({ key, label, colSpan: 1 });
      }
    });
    return groups;
  }, [timelineMonths]);

  if (isLoaded && !permissions.gapAnalysis.canView) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">無權限檢視此頁面</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            訪客帳號無法存取「專案-Gap Analysis」，請先登入具備存取權限的帳號。
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsLoginDialogOpen(true)}>登入系統</Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/dashboard')}>返回總表</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-12">
      {/* 頂部操作工具列 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              專案-Gap Analysis
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              原始規劃時程 vs 後續執行方案進度
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            以四大階段原始日期規劃呈現前後順序，並將後續新的執行方案與實際完成天數往後展開比對。
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 專案選擇下拉 */}
          <div className="w-64 sm:w-72">
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                setSelectedProjectId(val);
                setExpandedProjects((prev) => ({ ...prev, [val]: true }));
              }}
            >
              <SelectTrigger className="h-9 text-xs font-semibold bg-slate-50 border-slate-300">
                <SelectValue placeholder="選擇檢視專案" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {filteredProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    [{p.caseNumber || '未編號'}] {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 設定規劃時程按鈕 */}
          {permissions.gapAnalysis.canManage && currentProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="h-9 text-xs flex items-center gap-1.5 border-slate-300 hover:bg-slate-100 font-medium"
            >
              <Settings className="h-3.5 w-3.5 text-slate-600" />
              設定四大階段規劃時程
            </Button>
          )}

          {/* 新增待辦事項按鈕 */}
          {permissions.gapAnalysis.canManage && currentProject && (
            <Button
              size="sm"
              onClick={() => {
                setEditingActionItem(null);
                setIsAddActionItemOpen(true);
              }}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 font-medium shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              新增專案待辦
            </Button>
          )}
        </div>
      </div>

      {/* 圖例說明與提示條 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-700">圖例說明：</span>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-2.5 bg-slate-900 rounded-xs inline-block" />
            <span className="font-medium text-slate-800">上方黑 Bar：原始預定規劃時程 (依階段前後順序)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-2.5 bg-blue-600 rounded-xs inline-block" />
            <span className="font-medium text-blue-800">下方藍 Bar：如期完成 / 正常執行</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-2.5 bg-red-600 rounded-xs inline-block" />
            <span className="font-medium text-red-700 font-bold">下方紅 Bar：超過原規劃 / 新執行方案往後展延</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-emerald-500 inline-block border-t-2 border-emerald-500" />
            <span className="font-medium text-emerald-800">綠色基準線：今日 ({todayStr})</span>
          </div>
        </div>

        {currentAnalysis?.isDefault && (
          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>目前為標準排程範本，點擊「設定四大階段規劃時程」即可自訂</span>
          </div>
        )}
      </div>

      {/* 甘特圖主容器 (仿人工製作甘特圖的前後階梯順序佈局) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="flex flex-col xl:flex-row">
          {/* 左欄：任務名稱、原始規劃日期與工期樹狀結構 */}
          <div className="w-full xl:w-[370px] shrink-0 border-b xl:border-b-0 xl:border-r border-slate-200 bg-white select-none">
            {/* 左欄表頭 */}
            <div className="h-[72px] border-b border-slate-200 px-3.5 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">任務名稱</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  (原始規劃期程 / 執行方案)
                </span>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                4 階段
              </Badge>
            </div>

            {/* 左欄項目列表 */}
            {currentAnalysis && (
              <div className="divide-y divide-slate-100">
                {/* 1. 主專案列 */}
                <div
                  className="h-14 px-3 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/80 transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedProjects((prev) => ({
                      ...prev,
                      [currentAnalysis.project.id]: !prev[currentAnalysis.project.id],
                    }))
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <button
                      type="button"
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    >
                      {expandedProjects[currentAnalysis.project.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div
                        className="font-bold text-xs text-slate-900 truncate"
                        title={currentAnalysis.project.name}
                      >
                        [{currentAnalysis.project.caseNumber || '未編號'}] {currentAnalysis.project.name}
                      </div>
                      {currentAnalysis.projectPlanStart && currentAnalysis.projectPlanEnd && (
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          原規劃：{currentAnalysis.projectPlanStart.replace(/-/g, '/')} ~{' '}
                          {currentAnalysis.projectPlanEnd.replace(/-/g, '/')} ({currentAnalysis.projectPlanDays}天)
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 bg-white">
                    {currentAnalysis.project.projectCategory || '已開案'}
                  </Badge>
                </div>

                {/* 2. 四大階段列 (可展開查看待辦細項) */}
                {expandedProjects[currentAnalysis.project.id] &&
                  currentAnalysis.phasesData.map((phase) => {
                    const phaseKeyId = `${currentAnalysis.project.id}-${phase.key}`;
                    const isPhaseExpanded = !!expandedPhases[phaseKeyId];
                    const hasItems = phase.actual.items.length > 0;

                    return (
                      <div key={phase.key} className="bg-white">
                        {/* 階段列 */}
                        <div
                          className="h-16 px-3.5 pl-6 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100"
                          onClick={() => {
                            if (hasItems) {
                              setExpandedPhases((prev) => ({
                                ...prev,
                                [phaseKeyId]: !prev[phaseKeyId],
                              }));
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {hasItems ? (
                              <button
                                type="button"
                                className="p-0.5 hover:bg-slate-200 rounded text-slate-500 shrink-0"
                              >
                                {isPhaseExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-3.5 h-3.5 inline-block text-slate-300 text-center text-xs shrink-0">
                                ▷
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>{phase.fullName}</span>
                                <span className="text-[10px] font-normal text-slate-500">
                                  ({phase.planDays}天)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                規劃：{phase.plan.startDate.slice(5).replace('-', '/')} ~{' '}
                                {phase.plan.endDate.slice(5).replace('-', '/')}
                                {' ｜ '}
                                {hasItems
                                  ? `${phase.actual.completedCount}/${phase.actual.totalCount} 項完成`
                                  : '尚無待辦'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                phase.statusVariant === 'success'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : phase.statusVariant === 'destructive'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : phase.statusVariant === 'warning'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {phase.statusText}
                            </span>
                          </div>
                        </div>

                        {/* 展開之細項規劃 / 待辦事項明細 (依時間先後順序排列) */}
                        {isPhaseExpanded &&
                          phase.actual.items.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (permissions.gapAnalysis.canManage) {
                                  setEditingActionItem(item);
                                  setIsAddActionItemOpen(true);
                                }
                              }}
                              className="h-10 px-3.5 pl-10 flex items-center justify-between text-[11px] bg-slate-50/50 hover:bg-blue-50/40 border-b border-slate-100/80 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    item.status === 'completed'
                                      ? 'bg-emerald-500'
                                      : item.status === 'blocked'
                                      ? 'bg-rose-500'
                                      : 'bg-blue-500'
                                  }`}
                                />
                                <span className="text-slate-700 truncate font-medium" title={item.title}>
                                  {item.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {item.resolvedStart.slice(5).replace('-', '/')}~
                                  {item.resolvedEnd.slice(5).replace('-', '/')}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* 右欄：甘特圖時間軸 (原始規劃階梯黑 Bar + 後續執行方案藍/紅 Bar + 細項完成天數) */}
          <div className="flex-1 overflow-x-auto relative bg-slate-50/30 min-w-0">
            <div
              style={{ width: `${totalTimelineWidth}px` }}
              className="relative select-none"
            >
              {/* 時間軸表頭：季度列 (頂層) */}
              <div className="h-9 border-b border-slate-200 bg-slate-100/90 flex text-xs font-bold text-slate-700">
                {quarterGroups.map((q, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${q.colSpan * monthWidth}px` }}
                    className="border-r border-slate-200/80 flex items-center justify-center tracking-wide truncate px-1"
                  >
                    {q.label}
                  </div>
                ))}
              </div>

              {/* 時間軸表頭：月份列 (底層) */}
              <div className="h-9 border-b border-slate-200 bg-slate-50/90 flex text-xs font-semibold text-slate-600">
                {timelineMonths.map((m, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${monthWidth}px` }}
                    className="border-r border-slate-200/80 flex items-center justify-center text-[11px]"
                  >
                    {format(m, 'yyyy年M月')}
                  </div>
                ))}
              </div>

              {/* 今日垂直綠線 (Today Line - 貫穿整個圖表) */}
              {todayX !== null && todayX >= 0 && todayX <= totalTimelineWidth && (
                <div
                  style={{ left: `${todayX}px` }}
                  className="absolute top-0 bottom-0 w-0 border-l-2 border-emerald-500 z-30 pointer-events-none"
                >
                  <div className="sticky top-0 -ml-7 px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold shadow-xs whitespace-nowrap">
                    今日 {format(today, 'M/d')}
                  </div>
                </div>
              )}

              {/* 時間軸本體列 */}
              {currentAnalysis && (
                <div className="relative divide-y divide-slate-100">
                  {/* 背景月份垂直格線 */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {timelineMonths.map((_, idx) => (
                      <div
                        key={idx}
                        style={{ width: `${monthWidth}px` }}
                        className="h-full border-r border-slate-200/50"
                      />
                    ))}
                  </div>

                  {/* 1. 主專案總進程列 (黑色頂層總長 Bar，仿人工圖示帶端點括號與起訖日期) */}
                  <div className="h-14 relative flex items-center">
                    {(() => {
                      const startX = getXForDate(currentAnalysis.projectPlanStart);
                      const endX = getXForDate(currentAnalysis.projectPlanEnd);
                      if (startX === null || endX === null) return null;
                      const width = Math.max(endX - startX, 16);

                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                style={{
                                  left: `${startX}px`,
                                  width: `${width}px`,
                                }}
                                className="absolute h-4 bg-slate-900 rounded-xs shadow-xs flex items-center justify-between px-1 cursor-pointer transition-all hover:bg-black group z-10"
                              >
                                {/* 左下三角端點 (仿人工製作圖示) */}
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-900 absolute -bottom-1 left-0" />
                                <span className="text-[10px] font-bold text-white/95 truncate px-1.5">
                                  全案原始規劃：{currentAnalysis.projectPlanStart} ~ {currentAnalysis.projectPlanEnd} ({currentAnalysis.projectPlanDays}天)
                                </span>
                                {/* 右下三角端點 */}
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-900 absolute -bottom-1 right-0" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white text-xs p-2.5">
                              <p className="font-bold">{currentAnalysis.project.name}</p>
                              <p>原始規劃區間：{currentAnalysis.projectPlanStart} ~ {currentAnalysis.projectPlanEnd}</p>
                              <p>原規劃總天數：{currentAnalysis.projectPlanDays} 天</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>

                  {/* 2. 四大階段雙 Bar (上方黑色原始規劃階梯 Bar，下方藍/紅色實際與新執行方案 Bar) */}
                  {expandedProjects[currentAnalysis.project.id] &&
                    currentAnalysis.phasesData.map((phase, phaseIdx) => {
                      const phaseKeyId = `${currentAnalysis.project.id}-${phase.key}`;
                      const isPhaseExpanded = !!expandedPhases[phaseKeyId];

                      // 計算原始規劃 Bar 座標
                      const planStartX = getXForDate(phase.plan.startDate);
                      const planEndX = getXForDate(phase.plan.endDate);
                      const planWidth =
                        planStartX !== null && planEndX !== null
                          ? Math.max(planEndX - planStartX, 12)
                          : 0;

                      // 計算下一階段規劃起點 (繪製前後順序階梯導引箭頭，仿人工圖示)
                      const nextPhase =
                        phaseIdx < currentAnalysis.phasesData.length - 1
                          ? currentAnalysis.phasesData[phaseIdx + 1]
                          : null;
                      const nextPlanStartX = nextPhase
                        ? getXForDate(nextPhase.plan.startDate)
                        : null;

                      // 計算實際 Bar 座標 (依據待辦事項)
                      const actualStartX = getXForDate(phase.actual.actualStart);
                      const actualEndX = getXForDate(phase.actual.actualEnd);
                      const actualWidth =
                        actualStartX !== null && actualEndX !== null
                          ? Math.max(actualEndX - actualStartX, 12)
                          : 0;

                      const planStartShort = phase.plan.startDate
                        ? format(parseISO(phase.plan.startDate), 'M/d')
                        : '';
                      const planEndShort = phase.plan.endDate
                        ? format(parseISO(phase.plan.endDate), 'M/d')
                        : '';

                      return (
                        <div key={phase.key} className="relative">
                          {/* 階段列：高度 64px 容納上下雙 Bar */}
                          <div className="h-16 relative border-b border-slate-100 flex flex-col justify-center">
                            {/* 上方 Bar：原始規劃期程 (黑色 Bar + 左右日期標示 + 階梯連接箭頭) */}
                            {planStartX !== null && planWidth > 0 && (
                              <>
                                {/* 左側起始日標籤 (仿人工製作圖示 6/16, 8/4, 9/11, 11/21) */}
                                <span
                                  style={{
                                    left: `${Math.max(2, planStartX - 30)}px`,
                                    top: '10px',
                                  }}
                                  className="absolute text-[10px] font-bold text-slate-700 pointer-events-none"
                                >
                                  {planStartShort}
                                </span>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        style={{
                                          left: `${planStartX}px`,
                                          width: `${planWidth}px`,
                                          top: '10px',
                                        }}
                                        className="absolute h-4 bg-slate-900 rounded-xs shadow-2xs flex items-center justify-between px-1 cursor-pointer hover:bg-black transition-all group z-10"
                                      >
                                        <div className="w-1 h-2 border-l border-t border-b border-white/90" />
                                        {planWidth > 75 && (
                                          <span className="text-[9px] font-semibold text-white/95 truncate px-1">
                                            原規劃 ({phase.planDays}天)
                                          </span>
                                        )}
                                        <div className="w-1 h-2 border-r border-t border-b border-white/90" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs bg-slate-900 text-white p-2.5">
                                      <p className="font-bold">⬛ {phase.fullName} (原始預定規劃)</p>
                                      <p>規劃起訖：{phase.plan.startDate} ~ {phase.plan.endDate}</p>
                                      <p>規劃天數：{phase.planDays} 天</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {/* 右側結束日標籤 (仿人工製作圖示 8/1, 9/10, 11/20, 12/26) */}
                                <span
                                  style={{
                                    left: `${planStartX + planWidth + 5}px`,
                                    top: '10px',
                                  }}
                                  className="absolute text-[10px] font-bold text-slate-700 pointer-events-none"
                                >
                                  {planEndShort}
                                </span>

                                {/* 階段前後順序階梯導引箭頭 (連接本階段結束點與下一階段開始點) */}
                                {nextPlanStartX !== null && !isPhaseExpanded && (
                                  <div
                                    style={{
                                      left: `${planStartX + planWidth}px`,
                                      top: '24px',
                                      height: '44px',
                                    }}
                                    className="absolute border-l border-dashed border-blue-500/70 z-20 pointer-events-none flex flex-col justify-end items-center"
                                  >
                                    <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] border-t-blue-600 -ml-[1px]" />
                                  </div>
                                )}
                              </>
                            )}

                            {/* 下方 Bar：實際期程 / 後續新執行方案 (正常為藍色，超過原規劃往後展延時以紅色顯示) */}
                            {actualStartX !== null && actualWidth > 0 ? (
                              (() => {
                                const isDelayed =
                                  phase.statusVariant === 'destructive' ||
                                  (phase.varianceDays !== null && phase.varianceDays > 0);

                                // 若實際執行方案起點在原規劃結束點之後，繪製虛線串接表示「原規劃後的新執行方案延伸」
                                const hasExtensionGap =
                                  planStartX !== null &&
                                  planWidth > 0 &&
                                  actualStartX > planStartX + planWidth + 4;

                                return (
                                  <>
                                    {hasExtensionGap && (
                                      <div
                                        style={{
                                          left: `${planStartX + planWidth}px`,
                                          width: `${actualStartX - (planStartX + planWidth)}px`,
                                          bottom: '17px',
                                        }}
                                        className="absolute border-b-2 border-dotted border-red-400/80 z-0 pointer-events-none"
                                      />
                                    )}

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            style={{
                                              left: `${actualStartX}px`,
                                              width: `${actualWidth}px`,
                                              bottom: '10px',
                                            }}
                                            className={`absolute h-4 rounded-xs shadow-2xs flex items-center px-1.5 cursor-pointer transition-all z-10 ${
                                              isDelayed
                                                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 ring-1 ring-red-400'
                                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                            }`}
                                          >
                                            <span className="text-[9px] font-bold text-white truncate">
                                              實際：{phase.actual.actualStart} ~{' '}
                                              {phase.actual.isCompleted ? phase.actual.actualEnd : '進行中'}
                                              {phase.actual.actualDays ? ` (${phase.actual.actualDays}天)` : ''}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          className={`text-xs p-2.5 border ${
                                            isDelayed
                                              ? 'bg-red-950 text-white border-red-800'
                                              : 'bg-blue-950 text-white border-blue-800'
                                          }`}
                                        >
                                          <p className={`font-bold ${isDelayed ? 'text-red-200' : 'text-blue-200'}`}>
                                            {isDelayed ? '🟥' : '🟦'} {phase.fullName} (實際執行 -{' '}
                                            {isDelayed ? '超過原規劃 / 新執行方案' : '如期完成'})
                                          </p>
                                          <p>實際起始：{phase.actual.actualStart}</p>
                                          <p>
                                            實際截止：
                                            {phase.actual.isCompleted
                                              ? `${phase.actual.actualEnd} (全數結案)`
                                              : `${phase.actual.actualEnd} (進行中)`}
                                          </p>
                                          {phase.actual.actualDays && (
                                            <p>執行天數：共 {phase.actual.actualDays} 天</p>
                                          )}
                                          <p>
                                            待辦完成度：{phase.actual.completedCount} / {phase.actual.totalCount} 項
                                          </p>
                                          <p
                                            className={`font-semibold mt-1 ${
                                              isDelayed ? 'text-red-300 font-bold' : 'text-emerald-300'
                                            }`}
                                          >
                                            差異分析：{phase.statusText}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </>
                                );
                              })()
                            ) : (
                              /* 尚無待辦實際時，顯示虛線引導於原規劃下方 */
                              <div
                                style={{
                                  left: `${planStartX || 0}px`,
                                  bottom: '12px',
                                }}
                                className="absolute text-[10px] text-slate-400 italic pl-1 whitespace-nowrap"
                              >
                                (尚未有實際待辦事項執行紀錄)
                              </div>
                            )}
                          </div>

                          {/* 展開時個別細項規畫項目 (待辦事項) 的時間 Bar + BAR 後直接顯示完成天數 */}
                          {isPhaseExpanded &&
                            phase.actual.items.map((item) => {
                              const iStartX = getXForDate(item.resolvedStart);
                              const iEndX = getXForDate(item.resolvedEnd);
                              const iWidth =
                                iStartX !== null && iEndX !== null
                                  ? Math.max(iEndX - iStartX, 10)
                                  : 0;

                              const isCompleted = item.status === 'completed';

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (permissions.gapAnalysis.canManage) {
                                      setEditingActionItem(item);
                                      setIsAddActionItemOpen(true);
                                    }
                                  }}
                                  className="h-10 relative border-b border-slate-100/80 flex items-center bg-slate-50/20 hover:bg-blue-50/20 transition-colors cursor-pointer"
                                >
                                  {iStartX !== null && iWidth > 0 && (
                                    <>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div
                                              style={{
                                                left: `${iStartX}px`,
                                                width: `${iWidth}px`,
                                              }}
                                              className={`absolute h-3 rounded-xs shadow-2xs cursor-pointer transition-all z-10 ${
                                                isCompleted
                                                  ? 'bg-emerald-500 hover:bg-emerald-600'
                                                  : item.isItemDelayed
                                                  ? 'bg-red-500 hover:bg-red-600'
                                                  : item.status === 'blocked'
                                                  ? 'bg-amber-500 hover:bg-amber-600'
                                                  : 'bg-blue-500 hover:bg-blue-600'
                                              }`}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs space-y-1">
                                            <p className="font-bold">{item.title}</p>
                                            <p>
                                              狀態：{isCompleted ? '已完成' : item.status === 'blocked' ? '卡關中' : '進行中'}
                                              {item.isItemDelayed ? ' (超過原階段規劃期程)' : ''}
                                            </p>
                                            <p>負責/等候：{item.owner} / {item.waitingOn || '無'}</p>
                                            <p>
                                              執行期間：{item.resolvedStart} ~ {item.resolvedEnd}
                                            </p>
                                            <p className="font-bold text-emerald-400">
                                              {isCompleted
                                                ? `完成天數：${item.durationDays} 天`
                                                : `已進行：${item.elapsedDays} 天 (預計共 ${item.durationDays} 天)`}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      {/* 細項規畫項目 BAR 後直接顯示完成天數標籤 */}
                                      <div
                                        style={{
                                          left: `${iStartX + iWidth + 6}px`,
                                        }}
                                        className={`absolute z-20 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-2xs border ${
                                          isCompleted
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : item.isItemDelayed
                                            ? 'bg-red-50 text-red-700 border-red-300'
                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}
                                      >
                                        <span>
                                          {isCompleted
                                            ? `${item.durationDays}天`
                                            : `進行中 ${item.elapsedDays}天`}
                                        </span>
                                        <span className="text-[9px] font-normal opacity-80">
                                          ({item.resolvedStart.slice(5).replace('-', '/')}~
                                          {item.resolvedEnd.slice(5).replace('-', '/')})
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部四階段差異分析詳細卡片 */}
      {currentAnalysis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentAnalysis.phasesData.map((phase) => (
            <Card key={phase.key} className="border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                    <span>{phase.fullName}</span>
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      phase.statusVariant === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : phase.statusVariant === 'destructive'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : phase.statusVariant === 'warning'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {phase.statusText}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  <div className="flex justify-between">
                    <span className="text-slate-500">⬛ 預定規劃：</span>
                    <span className="font-semibold text-slate-800">
                      {phase.plan.startDate.replace(/-/g, '/')} ~ {phase.plan.endDate.slice(5).replace(/-/g, '/')} ({phase.planDays}天)
                    </span>
                  </div>
                  {(() => {
                    const isDelayed =
                      phase.statusVariant === 'destructive' ||
                      (phase.varianceDays !== null && phase.varianceDays > 0);
                    return (
                      <div className="flex justify-between">
                        <span className="text-slate-500">
                          {isDelayed ? '🟥 實際執行：' : '🟦 實際執行：'}
                        </span>
                        <span className={`font-semibold ${isDelayed ? 'text-red-600 font-bold' : 'text-blue-700'}`}>
                          {phase.actual.actualStart
                            ? `${phase.actual.actualStart.replace(/-/g, '/')} ~ ${
                                phase.actual.isCompleted
                                  ? phase.actual.actualEnd?.slice(5).replace(/-/g, '/')
                                  : '進行中'
                              }${phase.actual.actualDays ? ` (${phase.actual.actualDays}天)` : ''}`
                            : '尚無待辦'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">關聯待辦事項：</span>
                  <span className="font-semibold text-slate-700">
                    {phase.actual.completedCount} / {phase.actual.totalCount} 項完成
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 彈出視窗：編輯專案四大階段規劃時程 */}
      {currentProject && (
        <EditPhaseScheduleDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          project={currentProject}
          onSuccess={handleScheduleSaved}
        />
      )}

      {/* 彈出視窗：新增或編輯待辦事項 */}
      {currentProject && (
        <ActionItemDialog
          open={isAddActionItemOpen}
          onOpenChange={(open) => {
            setIsAddActionItemOpen(open);
            if (!open) setEditingActionItem(null);
          }}
          item={editingActionItem}
          defaultProjectId={currentProject.id}
          projects={projects}
          users={users}
          clients={clients}
          actionItems={actionItems}
          onSuccess={handleActionItemSaved}
        />
      )}
    </div>
  );
}
