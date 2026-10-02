'use client';

import React, { useState, useMemo } from 'react';
import { PMLearningCourse } from '@/types/pm-learning';
import { User, CurrentUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Award,
  TrendingUp,
  BarChart3,
  User as UserIcon,
  ArrowUpDown,
  Edit3,
  Check,
  X,
  Sparkles,
  ExternalLink,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { updateCourseHours } from '@/lib/pm-learning-actions';
import { useToast } from '@/hooks/use-toast';

interface WeeklyKPIViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  currentUser?: CurrentUser | null;
  onSelectMemberInPersonalView: (userId: string) => void;
  onCourseUpdated: (course: PMLearningCourse) => void;
}

// 輔助函式：計算某日期的西元年與 ISO 週次 (例如: { year: 2026, week: 39, label: '2026年第39週', range: '09/21 ~ 09/27' })
function getWeekInfo(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return {
      year: new Date().getFullYear(),
      week: 1,
      key: 'unknown',
      label: '未指定週次',
      range: '無明確日期',
      sortKey: 0,
    };
  }

  // 取得該日期所在週的星期一與星期日
  const day = d.getDay(); // 0 is Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO 週次計算
  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const days = Math.floor((monday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const monStr = `${pad(monday.getMonth() + 1)}/${pad(monday.getDate())}`;
  const sunStr = `${pad(sunday.getMonth() + 1)}/${pad(sunday.getDate())}`;

  return {
    year: monday.getFullYear(),
    week: weekNumber,
    key: `${monday.getFullYear()}-W${pad(weekNumber)}`,
    label: `${monday.getFullYear()} 年 第 ${weekNumber} 週`,
    range: `${monStr} ~ ${sunStr}`,
    sortKey: monday.getTime(),
  };
}

export function WeeklyKPIView({
  courses,
  pmoMembers,
  currentUser,
  onSelectMemberInPersonalView,
  onCourseUpdated,
}: WeeklyKPIViewProps) {
  const { toast } = useToast();

  // 篩選與排序狀態
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [memberKpiSortBy, setMemberKpiSortBy] = useState<'hours' | 'courses' | 'rate' | 'name'>('hours');
  // 快速編輯時數中的 courseId
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editHoursVal, setEditHoursVal] = useState<number>(0);

  // 1. 整理所有「已完成」的學習紀錄（扁平化為單筆完訓事件）
  interface CompletedEvent {
    course: PMLearningCourse;
    userId: string;
    userName: string;
    completedDate: string;
    hours: number;
    weekInfo: ReturnType<typeof getWeekInfo>;
    notesSnippet: string;
  }

  const completedEvents = useMemo(() => {
    const list: CompletedEvent[] = [];

    (courses || []).forEach((c) => {
      const cHours = Number(c.hours) || 0;

      // 檢查指派成員中已完成的人員
      (c.assignedUserIds || []).forEach((uid) => {
        const prog = (c.memberProgress || {})[uid];
        const isDone = prog?.isCompleted || (prog?.progressPercent ?? 0) >= 100;
        if (isDone) {
          // 決定完成日期
          const dateStr =
            prog?.completedAt ||
            prog?.updatedAt ||
            c.endDate ||
            c.updatedAt ||
            new Date().toISOString();

          const memberObj = (pmoMembers || []).find((m) => m.uid === uid);
          const userName = memberObj?.displayName || memberObj?.email || prog?.userName || 'PM成員';

          list.push({
            course: c,
            userId: uid,
            userName,
            completedDate: String(dateStr).slice(0, 10),
            hours: cHours,
            weekInfo: getWeekInfo(dateStr),
            notesSnippet: prog?.notes ? prog.notes.slice(0, 100) : '',
          });
        }
      });
    });

    return list;
  }, [courses, pmoMembers]);

  // 2. 依照「成員個人」聚合 KPI 數據
  const memberKpiList = useMemo(() => {
    return (pmoMembers || []).map((member) => {
      // 該成員指派到的所有課程
      const assigned = (courses || []).filter((c) => (c.assignedUserIds || []).includes(member.uid));
      let totalPlannedHours = 0;
      let completedHours = 0;
      let completedCount = 0;
      let inProgressCount = 0;

      assigned.forEach((c) => {
        const h = Number(c.hours) || 0;
        totalPlannedHours += h;

        const prog = (c.memberProgress || {})[member.uid];
        const p = prog?.progressPercent ?? 0;
        const isDone = prog?.isCompleted || p >= 100;

        if (isDone) {
          completedCount++;
          completedHours += h;
        } else if (p > 0) {
          inProgressCount++;
        }
      });

      const courseRate = assigned.length > 0 ? Math.round((completedCount / assigned.length) * 100) : 0;
      const hoursRate = totalPlannedHours > 0 ? Math.round((completedHours / totalPlannedHours) * 100) : 0;

      return {
        member,
        totalCourses: assigned.length,
        completedCount,
        inProgressCount,
        totalPlannedHours,
        completedHours,
        courseRate,
        hoursRate,
      };
    });
  }, [courses, pmoMembers]);

  // 成員排序
  const sortedMemberKpiList = useMemo(() => {
    const list = [...memberKpiList];
    if (memberKpiSortBy === 'hours') {
      return list.sort((a, b) => b.completedHours - a.completedHours || b.hoursRate - a.hoursRate);
    }
    if (memberKpiSortBy === 'courses') {
      return list.sort((a, b) => b.completedCount - a.completedCount || b.courseRate - a.courseRate);
    }
    if (memberKpiSortBy === 'rate') {
      return list.sort((a, b) => b.hoursRate - a.hoursRate || b.courseRate - a.courseRate);
    }
    // name
    return list.sort((a, b) =>
      (a.member.displayName || '').localeCompare(b.member.displayName || '')
    );
  }, [memberKpiList, memberKpiSortBy]);

  // 3. 團隊整體 KPI 數據
  const overallKPI = useMemo(() => {
    let totalAssignedEntries = 0;
    let totalCompletedEntries = 0;
    let totalPlannedHours = 0;
    let totalCompletedHours = 0;

    (courses || []).forEach((c) => {
      const h = Number(c.hours) || 0;
      const assignedIds = c.assignedUserIds || [];
      const assignedCount = assignedIds.length;
      totalPlannedHours += h * assignedCount;

      assignedIds.forEach((uid) => {
        totalAssignedEntries++;
        const prog = (c.memberProgress || {})[uid];
        if (prog?.isCompleted || (prog?.progressPercent ?? 0) >= 100) {
          totalCompletedEntries++;
          totalCompletedHours += h;
        }
      });
    });

    const completionRate =
      totalAssignedEntries > 0 ? Math.round((totalCompletedEntries / totalAssignedEntries) * 100) : 0;
    const hoursRate =
      totalPlannedHours > 0 ? Math.round((totalCompletedHours / totalPlannedHours) * 100) : 0;

    // 計算本週完成數
    const nowWeek = getWeekInfo(new Date().toISOString());
    const thisWeekEvents = completedEvents.filter((e) => e.weekInfo.key === nowWeek.key);
    const thisWeekHours = thisWeekEvents.reduce((acc, e) => acc + e.hours, 0);

    return {
      totalCourses: courses.length,
      totalAssignedEntries,
      totalCompletedEntries,
      totalPlannedHours,
      totalCompletedHours,
      completionRate,
      hoursRate,
      thisWeekCount: thisWeekEvents.length,
      thisWeekHours,
      currentWeekLabel: nowWeek.label,
    };
  }, [courses, completedEvents]);

  // 4. 依「週次 (Week)」分組完訓事件清單
  const filteredEvents = useMemo(() => {
    if (selectedMemberFilter === 'all') return completedEvents;
    return completedEvents.filter((e) => e.userId === selectedMemberFilter);
  }, [completedEvents, selectedMemberFilter]);

  const weeklyGroupedEvents = useMemo(() => {
    const groups: Record<
      string,
      {
        weekInfo: ReturnType<typeof getWeekInfo>;
        events: CompletedEvent[];
        totalHours: number;
      }
    > = {};

    filteredEvents.forEach((ev) => {
      const key = ev.weekInfo.key;
      if (!groups[key]) {
        groups[key] = {
          weekInfo: ev.weekInfo,
          events: [],
          totalHours: 0,
        };
      }
      groups[key].events.push(ev);
      groups[key].totalHours += ev.hours;
    });

    // 依時間新到舊排序週次
    return Object.values(groups).sort((a, b) => b.weekInfo.sortKey - a.weekInfo.sortKey);
  }, [filteredEvents]);

  // 快速更新時數處理
  const handleQuickSaveHours = async (courseId: string) => {
    const cleanHours = Math.max(0, Number(editHoursVal) || 0);
    setEditingCourseId(null);

    const targetCourse = courses.find((c) => c.id === courseId);
    if (!targetCourse) return;

    const updated = { ...targetCourse, hours: cleanHours };
    onCourseUpdated(updated);

    try {
      const res = await updateCourseHours(courseId, cleanHours);
      if (res.success) {
        toast({
          title: '已更新培訓時數',
          description: `「${targetCourse.title}」已設定為 ${cleanHours} 小時`,
        });
      } else {
        toast({ title: '儲存失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '更新錯誤', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部說明區與本週快報 */}
      <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-amber-300">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">週完成進度與培訓時數 KPI 管制</h2>
            <Badge className="bg-amber-400 text-slate-900 font-bold border-none text-xs">
              📊 績效指標
            </Badge>
          </div>
          <p className="text-xs text-indigo-100/90 leading-relaxed max-w-2xl">
            依照每週交付時程追蹤結訓進度，直接在各課程旁維護培訓時數。提供個人、時數、課程數多維度達成率剖析，協助專案經理掌握學習曲線。
          </p>
        </div>

        {/* 本週即時產出快報 */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/15 flex items-center gap-5 shrink-0">
          <div>
            <div className="text-[11px] text-indigo-200 font-semibold">{overallKPI.currentWeekLabel}</div>
            <div className="text-2xl font-black text-amber-300 mt-0.5">
              {overallKPI.thisWeekCount} <span className="text-sm font-normal text-white">堂完訓</span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <div className="text-[11px] text-indigo-200 font-semibold">本週累計結訓時數</div>
            <div className="text-2xl font-black text-emerald-300 mt-0.5">
              {overallKPI.thisWeekHours} <span className="text-sm font-normal text-white">小時</span>
            </div>
          </div>
        </div>
      </div>

      {/* 頂部全團隊 KPI 核心指標卡片列 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 指標 1: 總完訓時數 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">累計培訓時數 (小時)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {overallKPI.totalCompletedHours}{' '}
              <span className="text-xs font-semibold text-slate-400">
                / {overallKPI.totalPlannedHours} 小時
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mt-2">
              <span>時數達成率</span>
              <span>{overallKPI.hoursRate}%</span>
            </div>
            <Progress value={overallKPI.hoursRate} className="h-2 mt-1.5 bg-amber-100" />
          </div>
        </div>

        {/* 指標 2: 完訓課程人次 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">完訓課程總人次</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">
              {overallKPI.totalCompletedEntries}{' '}
              <span className="text-xs font-semibold text-slate-400">
                / {overallKPI.totalAssignedEntries} 人次
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mt-2">
              <span>課程達成率</span>
              <span>{overallKPI.completionRate}%</span>
            </div>
            <Progress value={overallKPI.completionRate} className="h-2 mt-1.5 bg-emerald-100" />
          </div>
        </div>

        {/* 指標 3: 總培訓課程門數 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">現行開放課程門數</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{overallKPI.totalCourses} 門</div>
            <p className="text-xs text-slate-400 mt-2">
              涵蓋專案四大階段治理與智慧製造
            </p>
          </div>
        </div>

        {/* 指標 4: 培訓團隊陣容 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">億威 PMO 培訓陣容</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <UserIcon className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-blue-700">{pmoMembers.length} 位</div>
            <p className="text-xs text-slate-400 mt-2">
              成員可於個人工作區自訂呈現順序
            </p>
          </div>
        </div>
      </div>

      {/* 區塊一：依個人維度呈現之學習 KPI 戰報 (依照個人、時數、課程數剖析) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <span>個人學習成果與時數 KPI 總表</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              依照個人、完訓時數、課程數及整體達成率對比分析
            </p>
          </div>

          {/* 排序切換器 */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs">
            <span className="text-slate-500 font-semibold px-2 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              <span>排序維度:</span>
            </span>
            <button
              type="button"
              onClick={() => setMemberKpiSortBy('hours')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                memberKpiSortBy === 'hours'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              依完訓時數 (高→低)
            </button>
            <button
              type="button"
              onClick={() => setMemberKpiSortBy('courses')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                memberKpiSortBy === 'courses'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              依完訓課程數
            </button>
            <button
              type="button"
              onClick={() => setMemberKpiSortBy('rate')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                memberKpiSortBy === 'rate'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              依達成率 %
            </button>
            <button
              type="button"
              onClick={() => setMemberKpiSortBy('name')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                memberKpiSortBy === 'name'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              依個人姓名
            </button>
          </div>
        </div>

        {/* 成員 KPI 卡片網格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {sortedMemberKpiList.map((item, idx) => (
            <div
              key={item.member.uid}
              className="p-4 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50/50 hover:border-indigo-300 transition-all shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-linear-to-tr from-indigo-600 to-blue-500 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {(item.member.displayName || item.member.email || 'PM').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{item.member.displayName || item.member.email}</span>
                      {idx === 0 && memberKpiSortBy !== 'name' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                          <Award className="h-3 w-3 text-amber-600" />
                          TOP 1
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      億威 · {item.member.department || 'PMO'}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectMemberInPersonalView(item.member.uid)}
                  className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 gap-1 px-2 font-semibold"
                  title="前往該成員之個人工作區"
                >
                  <span>個人工作區</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 核心數據統計 */}
              <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">完訓時數</span>
                  <div className="text-base font-black text-amber-700 mt-0.5">
                    {item.completedHours}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {item.totalPlannedHours}h</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">完訓課程數</span>
                  <div className="text-base font-black text-emerald-700 mt-0.5">
                    {item.completedCount}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {item.totalCourses}門</span>
                  </div>
                </div>
              </div>

              {/* 進度條 */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">時數達成進度</span>
                  <span className="font-bold text-amber-700">{item.hoursRate}%</span>
                </div>
                <Progress value={item.hoursRate} className="h-2 bg-amber-100" />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                <span>進行中: {item.inProgressCount} 門</span>
                <span>課程達成率: {item.courseRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 區塊二：依每一週分組呈現課程完成明細清單 (每一周把多少課程完成 + 時數填寫) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                每週課程結訓與成果歷程 (Weekly Completion Timeline)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              依結案週次彙整完成紀錄，可直接點擊時數欄位快速維護培訓時數
            </p>
          </div>

          {/* 成員篩選器 */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">檢視成員:</span>
            <select
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">全體億威 PMO 成員</option>
              {pmoMembers.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName || m.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 無結訓紀錄提示 */}
        {weeklyGroupedEvents.length === 0 && (
          <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-700">目前尚無符合條件的課程結訓紀錄</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              成員在個人工作區將學習進度拉至 100% 或點選「標記為已完成」後，系統將自動依完訓週次收錄於此。
            </p>
          </div>
        )}

        {/* 週次分組時間軸 */}
        <div className="space-y-6">
          {weeklyGroupedEvents.map((weekGroup) => (
            <div
              key={weekGroup.weekInfo.key}
              className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs"
            >
              {/* 週次標題 Header */}
              <div className="p-4 bg-linear-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-xs">
                    {weekGroup.weekInfo.label}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    📅 {weekGroup.weekInfo.range}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    完訓 {weekGroup.events.length} 門課程
                  </span>
                  <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    累計 {weekGroup.totalHours} 小時
                  </span>
                </div>
              </div>

              {/* 該週結訓課程清單 */}
              <div className="divide-y divide-slate-100">
                {weekGroup.events.map((ev, evIdx) => (
                  <div
                    key={`${ev.course.id}-${ev.userId}-${evIdx}`}
                    className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* 左側：完訓成員 + 課程名稱 + 領域標籤 */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <UserIcon className="h-3 w-3" />
                          <span>{ev.userName}</span>
                        </span>

                        <span className="font-bold text-slate-900 text-sm">
                          {ev.course.title}
                        </span>

                        <Badge variant="outline" className="text-[11px] bg-slate-50 text-slate-600 border-slate-200">
                          {ev.course.category}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>講師/平台: {ev.course.instructorOrPlatform}</span>
                        <span>結案日期: {ev.completedDate}</span>
                        {ev.notesSnippet && (
                          <span className="text-slate-500 italic truncate max-w-md">
                            心得: {ev.notesSnippet}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 右側：時數維護欄位 (直接填寫時數) + 外部傳送門 */}
                    <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                      {/* 時數填寫欄位 */}
                      <div className="flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs text-amber-900 font-semibold">時數:</span>

                        {editingCourseId === ev.course.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              value={editHoursVal}
                              onChange={(e) => setEditHoursVal(Number(e.target.value))}
                              className="h-6 w-16 text-xs bg-white text-center font-bold px-1"
                              autoFocus
                            />
                            <span className="text-xs text-amber-900">h</span>
                            <button
                              type="button"
                              onClick={() => handleQuickSaveHours(ev.course.id)}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-100"
                              title="確認更新時數"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCourseId(null)}
                              className="p-1 rounded text-slate-400 hover:bg-slate-200"
                              title="取消"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-amber-800">
                              {ev.course.hours || 0} 小時
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCourseId(ev.course.id);
                                setEditHoursVal(ev.course.hours || 0);
                              }}
                              className="p-1 rounded text-amber-700 hover:bg-amber-100 transition-colors"
                              title="點擊填寫或修改此課程之培訓時數"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 外部傳送門 */}
                      {ev.course.externalUrl && (
                        <a
                          href={ev.course.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="開啟課程外部連結"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
