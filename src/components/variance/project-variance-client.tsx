'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  format,
  parseISO,
  isValid,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isAfter,
  isBefore,
} from 'date-fns';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
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
  getMajorPhaseName,
} from '@/lib/phase-constants';
import type {
  FullProject,
  ProjectActionItem,
  ProjectPhaseSchedules,
  PhaseSchedule,
  User,
  Client,
} from '@/types';

interface ProjectVarianceClientProps {
  initialProjects: FullProject[];
  initialActionItems: ProjectActionItem[];
  users?: User[];
  clients?: Client[];
}

const MONTH_WIDTH = 110; // 每個月份欄寬度 (px)

export function ProjectVarianceClient({
  initialProjects,
  initialActionItems,
  users = [],
  clients = [],
}: ProjectVarianceClientProps) {
  const { toast } = useToast();
  const { isEditor, isAdmin } = useAdmin();

  const [projects, setProjects] = useState<FullProject[]>(initialProjects);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>(initialActionItems);

  // 專案篩選與選中專案
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (initialProjects.length === 0) return '';
    // 預設選中烤一線或第一個專案
    const found = initialProjects.find(
      (p) => p.name.includes('烤一線') || p.name.includes('顯性缺陷')
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
    [`${selectedProjectId}-verification`]: false,
    [`${selectedProjectId}-acceptance`]: false,
  });

  // Dialog 控制
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddActionItemOpen, setIsAddActionItemOpen] = useState(false);

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

  // 自動依專案起訖或今年產生時間軸月份列表 (預設含前後緩衝月份，共 10-12 個月)
  const timelineMonths = useMemo(() => {
    const curYear = today.getFullYear();
    // 預設從今年 5 月至 12 月 + 明年 1 月
    const start = new Date(curYear, 4, 1); // 5月
    const months: Date[] = [];
    for (let i = 0; i < 9; i++) {
      months.push(addMonths(start, i));
    }
    return months;
  }, [today]);

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

  const totalTimelineWidth = timelineMonths.length * MONTH_WIDTH;

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
        startDate: ps.construction?.startDate || `${curYear}-07-15`,
        endDate: ps.construction?.endDate || `${curYear}-10-15`,
      },
      verification: {
        startDate: ps.verification?.startDate || `${curYear}-10-16`,
        endDate: ps.verification?.endDate || `${curYear}-11-15`,
      },
      acceptance: {
        startDate: ps.acceptance?.startDate || `${curYear}-11-16`,
        endDate: ps.acceptance?.endDate || `${curYear}-12-31`,
      },
    };

    return { schedules, isDefault: !hasCustom };
  };

  // 取得專案某一階段的實際執行起訖 (依據待辦事項)
  const getActualPhaseProgress = (
    projectId: string,
    phaseKey: MajorPhaseKey
  ) => {
    const items = actionItems.filter(
      (item) => item.projectId === projectId && getMajorPhaseKey(item.phase) === phaseKey
    );

    if (items.length === 0) {
      return {
        hasItems: false,
        items: [],
        actualStart: null,
        actualEnd: null,
        isCompleted: false,
        completedCount: 0,
        totalCount: 0,
      };
    }

    const completedCount = items.filter((i) => i.status === 'completed').length;
    const isCompleted = completedCount === items.length && items.length > 0;

    // 起始日：最早的 startedAt 或 createdAt
    const startTimestamps = items
      .map((i) => (i.startedAt ? new Date(i.startedAt).getTime() : new Date(i.createdAt).getTime()))
      .filter((t) => !isNaN(t));

    const minStartTime =
      startTimestamps.length > 0 ? Math.min(...startTimestamps) : null;
    const actualStart = minStartTime ? new Date(minStartTime) : null;

    // 結束日：
    // 若全數完成，取最晚的 completedAt 或 updatedAt
    // 若尚未全數完成且已啟動，則持續至今日！
    let actualEnd: Date | null = null;
    if (isCompleted) {
      const endTimestamps = items
        .map((i) => (i.completedAt ? new Date(i.completedAt).getTime() : (i.dueDate ? new Date(i.dueDate).getTime() : new Date(i.updatedAt).getTime())))
        .filter((t) => !isNaN(t));
      actualEnd = endTimestamps.length > 0 ? new Date(Math.max(...endTimestamps)) : today;
    } else if (actualStart) {
      // 進行中：延伸至今日或最晚完成項目
      const completedTimestamps = items
        .filter((i) => i.completedAt)
        .map((i) => new Date(i.completedAt!).getTime());
      const maxCompleted =
        completedTimestamps.length > 0 ? Math.max(...completedTimestamps) : today.getTime();
      actualEnd = new Date(Math.max(today.getTime(), maxCompleted));
    }

    return {
      hasItems: true,
      items,
      actualStart: actualStart ? format(actualStart, 'yyyy-MM-dd') : null,
      actualEnd: actualEnd ? format(actualEnd, 'yyyy-MM-dd') : null,
      isCompleted,
      completedCount,
      totalCount: items.length,
    };
  };

  // 當前選中專案的四大階段分析資料
  const currentAnalysis = useMemo(() => {
    if (!currentProject) return null;

    const { schedules, isDefault } = getProjectPhaseSchedules(currentProject);

    const phasesData = MAJOR_PHASES.map((p) => {
      const plan = schedules[p.key];
      const actual = getActualPhaseProgress(currentProject.id, p.key);

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
          const isOverdue = isAfter(today, planEnd);
          if (isOverdue) {
            const overdueDays = differenceInDays(today, planEnd);
            statusText = `逾期進行中 (+${overdueDays}天)`;
            statusVariant = 'destructive';
            varianceDays = overdueDays;
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
        actual,
        varianceDays,
        statusText,
        statusVariant,
      };
    });

    // 專案整體總起訖
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

    return {
      project: currentProject,
      isDefault,
      projectPlanStart,
      projectPlanEnd,
      phasesData,
    };
  }, [currentProject, actionItems, today]);

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

  // 季度分組輔助
  const quarterGroups = useMemo(() => {
    const groups: { label: string; colSpan: number }[] = [];
    timelineMonths.forEach((m) => {
      const monthNum = m.getMonth() + 1; // 1-12
      let qName = '';
      if (monthNum <= 3) qName = '第一季';
      else if (monthNum <= 6) qName = '第二季';
      else if (monthNum <= 9) qName = '第三季';
      else qName = '第四季';

      const year = m.getFullYear();
      const label = `${qName}`;

      if (groups.length > 0 && groups[groups.length - 1].label === label) {
        groups[groups.length - 1].colSpan += 1;
      } else {
        groups.push({ label, colSpan: 1 });
      }
    });
    return groups;
  }, [timelineMonths]);

  return (
    <div className="w-full space-y-5 pb-12">
      {/* 頂部操作工具列 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              專案差異分析
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              四大階段規劃 vs 待辦事項實際
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            針對設計、施工、驗證、驗收四大階段，比對預定規劃時程與待辦事項實際執行進程。
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
          {isEditor && currentProject && (
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
          {isEditor && currentProject && (
            <Button
              size="sm"
              onClick={() => setIsAddActionItemOpen(true)}
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
            <span className="font-medium text-slate-800">上方黑 Bar：預定規劃時程 (Planned)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-2.5 bg-blue-600 rounded-xs inline-block" />
            <span className="font-medium text-blue-800">下方藍 Bar：待辦事項實際期程 (Actual)</span>
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

      {/* 甘特圖主容器 (仿 Media 1 佈局) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="flex flex-col xl:flex-row">
          {/* 左欄：任務名稱樹狀結構 */}
          <div className="w-full xl:w-80 shrink-0 border-b xl:border-b-0 xl:border-r border-slate-200 bg-white select-none">
            {/* 左欄表頭 */}
            <div className="h-[73px] border-b border-slate-200 px-4 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">任務名稱</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  (四大階段進程)
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
                    <span className="font-bold text-xs text-slate-900 truncate" title={currentAnalysis.project.name}>
                      [{currentAnalysis.project.caseNumber || '未編號'}] {currentAnalysis.project.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 bg-white">
                    {currentAnalysis.project.projectCategory || '已開案'}
                  </Badge>
                </div>

                {/* 2. 四大階段列 (可展開查看待辦) */}
                {expandedProjects[currentAnalysis.project.id] &&
                  currentAnalysis.phasesData.map((phase) => {
                    const phaseKeyId = `${currentAnalysis.project.id}-${phase.key}`;
                    const isPhaseExpanded = !!expandedPhases[phaseKeyId];
                    const hasItems = phase.actual.items.length > 0;

                    return (
                      <div key={phase.key} className="bg-white">
                        {/* 階段列 */}
                        <div
                          className="h-16 px-4 pl-7 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100"
                          onClick={() => {
                            if (hasItems) {
                              setExpandedPhases((prev) => ({
                                ...prev,
                                [phaseKeyId]: !prev[phaseKeyId],
                              }));
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {hasItems ? (
                              <button
                                type="button"
                                className="p-0.5 hover:bg-slate-200 rounded text-slate-500"
                              >
                                {isPhaseExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-3.5 h-3.5 inline-block text-slate-300 text-center text-xs">
                                ▷
                              </span>
                            )}
                            <div>
                              <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>{phase.fullName}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {hasItems
                                  ? `${phase.actual.completedCount}/${phase.actual.totalCount} 項待辦完成`
                                  : '尚無此階段待辦事項'}
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

                        {/* 展開之待辦事項明細 */}
                        {isPhaseExpanded &&
                          phase.actual.items.map((item) => (
                            <div
                              key={item.id}
                              className="h-10 px-4 pl-12 flex items-center justify-between text-[11px] bg-slate-50/50 hover:bg-blue-50/40 border-b border-slate-100/80 transition-colors"
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
                                <span className="text-slate-700 truncate" title={item.title}>
                                  {item.title}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {item.dueDate ? item.dueDate.slice(5) : '無到期日'}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* 右欄：甘特圖時間軸 (雙 Bar: 上方規劃黑 Bar、下方實際藍 Bar) */}
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
                    style={{ width: `${q.colSpan * MONTH_WIDTH}px` }}
                    className="border-r border-slate-200/80 flex items-center justify-center tracking-wide"
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
                    style={{ width: `${MONTH_WIDTH}px` }}
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
                        style={{ width: `${MONTH_WIDTH}px` }}
                        className="h-full border-r border-slate-200/50"
                      />
                    ))}
                  </div>

                  {/* 1. 主專案總進程列 (黑色頂層總長 Bar) */}
                  <div className="h-14 relative flex items-center">
                    {(() => {
                      const startX = getXForDate(currentAnalysis.projectPlanStart);
                      const endX = getXForDate(currentAnalysis.projectPlanEnd);
                      if (startX === null || endX === null) return null;
                      const width = Math.max(endX - startX, 12);

                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                style={{
                                  left: `${startX}px`,
                                  width: `${width}px`,
                                }}
                                className="absolute h-5 bg-slate-900 rounded-sm shadow-xs flex items-center justify-between px-1 cursor-pointer transition-all hover:bg-black group"
                              >
                                {/* 左端點標記 (仿 Media 1 三角/括號端點) */}
                                <div className="w-1.5 h-2.5 border-l-2 border-white/80" />
                                <span className="text-[10px] font-bold text-white/90 truncate px-1">
                                  全案預定進程：{currentAnalysis.projectPlanStart} ~ {currentAnalysis.projectPlanEnd}
                                </span>
                                {/* 右端點標記 */}
                                <div className="w-1.5 h-2.5 border-r-2 border-white/80" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white text-xs p-2.5">
                              <p className="font-bold">{currentAnalysis.project.name}</p>
                              <p>規劃區間：{currentAnalysis.projectPlanStart} ~ {currentAnalysis.projectPlanEnd}</p>
                              <p>四大階段全週期時程</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>

                  {/* 2. 四大階段雙 Bar (上方黑色規劃 Bar，下方藍色實際 Bar) */}
                  {expandedProjects[currentAnalysis.project.id] &&
                    currentAnalysis.phasesData.map((phase) => {
                      const phaseKeyId = `${currentAnalysis.project.id}-${phase.key}`;
                      const isPhaseExpanded = !!expandedPhases[phaseKeyId];

                      // 計算規劃 Bar 座標
                      const planStartX = getXForDate(phase.plan.startDate);
                      const planEndX = getXForDate(phase.plan.endDate);
                      const planWidth =
                        planStartX !== null && planEndX !== null
                          ? Math.max(planEndX - planStartX, 10)
                          : 0;

                      // 計算實際 Bar 座標 (依據待辦事項)
                      const actualStartX = getXForDate(phase.actual.actualStart);
                      const actualEndX = getXForDate(phase.actual.actualEnd);
                      const actualWidth =
                        actualStartX !== null && actualEndX !== null
                          ? Math.max(actualEndX - actualStartX, 8)
                          : 0;

                      return (
                        <div key={phase.key}>
                          {/* 階段列：高度 64px 容納上下雙 Bar */}
                          <div className="h-16 relative border-b border-slate-100 flex flex-col justify-center">
                            {/* 上方 Bar：規劃期程 (黑色 Bar) */}
                            {planStartX !== null && planWidth > 0 && (
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
                                      {/* 左箭頭端帽 */}
                                      <div className="w-1 h-2 border-l border-t border-b border-white" />
                                      <span className="text-[9px] font-semibold text-white/95 truncate px-1 hidden sm:inline">
                                        規劃：{phase.plan.startDate} ~ {phase.plan.endDate}
                                      </span>
                                      {/* 右箭頭端帽 */}
                                      <div className="w-1 h-2 border-r border-t border-b border-white" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs bg-slate-900 text-white p-2.5">
                                    <p className="font-bold">⬛ {phase.fullName} (預定規劃)</p>
                                    <p>起訖日：{phase.plan.startDate} ~ {phase.plan.endDate}</p>
                                    <p>
                                      規劃天數：
                                      {differenceInDays(
                                        parseISO(phase.plan.endDate),
                                        parseISO(phase.plan.startDate)
                                      ) + 1}{' '}
                                      天
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* 下方 Bar：實際期程 (鮮豔藍色 Bar，若有待辦) */}
                            {actualStartX !== null && actualWidth > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      style={{
                                        left: `${actualStartX}px`,
                                        width: `${actualWidth}px`,
                                        bottom: '10px',
                                      }}
                                      className="absolute h-4 bg-blue-600 rounded-xs shadow-2xs flex items-center px-1.5 cursor-pointer hover:bg-blue-700 transition-all z-10"
                                    >
                                      <span className="text-[9px] font-bold text-white truncate">
                                        實際：{phase.actual.actualStart} ~ {phase.actual.isCompleted ? phase.actual.actualEnd : '進行中'}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs bg-blue-950 text-white p-2.5 border border-blue-800">
                                    <p className="font-bold text-blue-200">🟦 {phase.fullName} (待辦實際執行)</p>
                                    <p>實際起始：{phase.actual.actualStart}</p>
                                    <p>
                                      實際截止：
                                      {phase.actual.isCompleted
                                        ? `${phase.actual.actualEnd} (全數結案)`
                                        : `${phase.actual.actualEnd} (進行中)`}
                                    </p>
                                    <p>待辦完成度：{phase.actual.completedCount} / {phase.actual.totalCount} 項</p>
                                    <p className="font-semibold text-emerald-300 mt-1">
                                      差異分析：{phase.statusText}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              /* 尚無待辦實際時，顯示虛線引導 */
                              <div
                                style={{
                                  left: `${planStartX || 0}px`,
                                  bottom: '14px',
                                }}
                                className="absolute text-[10px] text-slate-400 italic pl-1"
                              >
                                (尚未有實際待辦事項執行紀錄)
                              </div>
                            )}
                          </div>

                          {/* 展開時個別待辦事項的時間 Bar */}
                          {isPhaseExpanded &&
                            phase.actual.items.map((item) => {
                              const itemStart = item.startedAt || item.createdAt;
                              const itemEnd = item.completedAt || item.dueDate || (item.status === 'completed' ? item.updatedAt : todayStr);
                              const iStartX = getXForDate(itemStart);
                              const iEndX = getXForDate(itemEnd);
                              const iWidth =
                                iStartX !== null && iEndX !== null
                                  ? Math.max(iEndX - iStartX, 6)
                                  : 0;

                              return (
                                <div
                                  key={item.id}
                                  className="h-10 relative border-b border-slate-100/80 flex items-center bg-slate-50/20"
                                >
                                  {iStartX !== null && iWidth > 0 && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            style={{
                                              left: `${iStartX}px`,
                                              width: `${iWidth}px`,
                                            }}
                                            className={`absolute h-2.5 rounded-xs shadow-2xs cursor-pointer transition-all ${
                                              item.status === 'completed'
                                                ? 'bg-emerald-500 hover:bg-emerald-600'
                                                : item.status === 'blocked'
                                                ? 'bg-rose-500 hover:bg-rose-600'
                                                : 'bg-blue-400 hover:bg-blue-500'
                                            }`}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs">
                                          <p className="font-bold">{item.title}</p>
                                          <p>狀態：{item.status}</p>
                                          <p>負責/等候：{item.owner} / {item.waitingOn || '無'}</p>
                                          <p>期間：{itemStart ? itemStart.slice(0, 10) : ''} ~ {itemEnd ? itemEnd.slice(0, 10) : ''}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
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
                      {phase.plan.startDate.slice(5)} ~ {phase.plan.endDate.slice(5)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">🟦 實際執行：</span>
                    <span className="font-semibold text-blue-700">
                      {phase.actual.actualStart
                        ? `${phase.actual.actualStart.slice(5)} ~ ${phase.actual.isCompleted ? phase.actual.actualEnd?.slice(5) : '進行中'}`
                        : '尚無待辦'}
                    </span>
                  </div>
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

      {/* 彈出視窗：新增待辦事項 */}
      {currentProject && (
        <ActionItemDialog
          open={isAddActionItemOpen}
          onOpenChange={setIsAddActionItemOpen}
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
