'use client';

import React, { useState, useMemo } from 'react';
import { PMLearningCourse, PMTeamDisplayMode } from '@/types/pm-learning';
import { User, CurrentUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Plus,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Kanban,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
  FileText,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';
import { deletePMLearningCourse } from '@/lib/pm-learning-actions';
import { isCourseManager, canUserEditCourse } from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';
import { MarkdownPreview } from './markdown-preview';

interface TeamViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  currentUser?: CurrentUser | null;
  onOpenCreateDialog: () => void;
  onEditCourse: (course: PMLearningCourse) => void;
  onCourseDeleted: (courseId: string) => void;
  onSelectMemberInPersonalView: (userId: string) => void;
}

export function TeamView({
  courses,
  pmoMembers,
  currentUser,
  onOpenCreateDialog,
  onEditCourse,
  onCourseDeleted,
  onSelectMemberInPersonalView,
}: TeamViewProps) {
  const { toast } = useToast();
  const [displayMode, setDisplayMode] = useState<PMTeamDisplayMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[]>([]);

  // 展開/收合單堂課程的成員明細
  const toggleExpand = (courseId: string) => {
    setExpandedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // 計算每堂課程的團隊平均完成率
  const getCourseTeamStats = (course: PMLearningCourse) => {
    const assignedIds = course.assignedUserIds || [];
    if (assignedIds.length === 0) {
      return { avgPercent: 0, completedCount: 0, totalCount: 0 };
    }
    let totalPercent = 0;
    let completedCount = 0;
    assignedIds.forEach((uid) => {
      const prog = course.memberProgress[uid];
      const p = prog?.progressPercent ?? 0;
      totalPercent += p;
      if (prog?.isCompleted || p >= 100) {
        completedCount++;
      }
    });
    const avgPercent = Math.round(totalPercent / assignedIds.length);
    return { avgPercent, completedCount, totalCount: assignedIds.length };
  };

  // 全團隊總體 KPI
  const teamOverallKPI = useMemo(() => {
    if (courses.length === 0) {
      return { totalCourses: 0, overallAvgPercent: 0, totalCertifications: 0, inProgressCourses: 0 };
    }
    let sumCourseAverages = 0;
    let totalCerts = 0;
    let inProgress = 0;

    courses.forEach((c) => {
      const stats = getCourseTeamStats(c);
      sumCourseAverages += stats.avgPercent;
      totalCerts += stats.completedCount;
      if (stats.avgPercent > 0 && stats.avgPercent < 100) {
        inProgress++;
      }
    });

    const overallAvg = Math.round(sumCourseAverages / courses.length);
    return {
      totalCourses: courses.length,
      overallAvgPercent: overallAvg,
      totalCertifications: totalCerts,
      inProgressCourses: inProgress,
    };
  }, [courses]);

  // 所有分類選項
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ['全部', ...Array.from(set)];
  }, [courses]);

  // 篩選後課程清單
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 關鍵字比對
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.instructorOrPlatform.toLowerCase().includes(q) ||
        (course.description || '').toLowerCase().includes(q) ||
        course.assignedUserNames.some((n) => n.toLowerCase().includes(q));

      // 分類比對
      const matchCategory = selectedCategory === '全部' || course.category === selectedCategory;

      // 成員篩選比對
      const matchMember =
        selectedMemberFilter === 'all' || course.assignedUserIds.includes(selectedMemberFilter);

      return matchSearch && matchCategory && matchMember;
    });
  }, [courses, searchQuery, selectedCategory, selectedMemberFilter]);

  // 刪除課程確認
  const handleDelete = async (courseId: string, title: string) => {
    if (!window.confirm(`確定要刪除「${title}」這門培訓課程嗎？此動作無法復原。`)) {
      return;
    }
    try {
      const res = await deletePMLearningCourse(courseId);
      if (res.success) {
        toast({ title: '已刪除課程', description: `課程「${title}」已成功移除` });
        onCourseDeleted(courseId);
      } else {
        toast({ title: '刪除失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '刪除出錯', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* 團隊總體指標看板 (KPI Summary Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">總培訓課程</span>
            <BookOpen className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{teamOverallKPI.totalCourses}</div>
          <div className="text-[11px] text-slate-400 mt-1">涵蓋專案治理與技術深度</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-xs font-semibold">團隊整體平均達成率</span>
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-700">{teamOverallKPI.overallAvgPercent}%</span>
            <span className="text-xs text-blue-600/80">({courses.length} 堂課平均)</span>
          </div>
          <div className="mt-2">
            <Progress value={teamOverallKPI.overallAvgPercent} className="h-1.5 bg-blue-100" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-semibold">已結訓人次</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{teamOverallKPI.totalCertifications}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">個人進度達 100% 之總計</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-semibold">積極推進中課程</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{teamOverallKPI.inProgressCourses}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">團隊全員持續修習中</div>
        </div>
      </div>

      {/* 搜尋、篩選與模式切換工具列 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* 關鍵字搜尋 */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋課程名稱、平台、成員..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* 分類篩選 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {allCategories.map((c) => (
              <option key={c} value={c}>
                類別: {c}
              </option>
            ))}
          </select>

          {/* 成員篩選 */}
          <select
            value={selectedMemberFilter}
            onChange={(e) => setSelectedMemberFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">所有指派成員</option>
            {pmoMembers.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName || m.email}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* 視角切換器: 列表 vs 看板 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                displayMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>列表呈現</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                displayMode === 'kanban'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>進度看板</span>
            </button>
          </div>

          {/* 主管理員權限提示 */}
          {isCourseManager(currentUser) && (
            <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs gap-1 font-semibold hidden sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              <span>主管理員編輯權限 (jamesyang / admin)</span>
            </Badge>
          )}

          {/* 新增課程按鈕 */}
          <Button
            type="button"
            onClick={onOpenCreateDialog}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-2xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>新增課程 / 指派成員</span>
          </Button>
        </div>
      </div>

      {/* 查無結果提示 */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">找不到符合條件的培訓課程</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            試著更換搜尋關鍵字，或點擊上方「新增課程 / 指派成員」建立新的培訓項目。
          </p>
        </div>
      )}

      {/* 視角一：列表呈現 (List / Table Mode) */}
      {displayMode === 'list' && filteredCourses.length > 0 && (
        <div className="space-y-3">
          {filteredCourses.map((course) => {
            const stats = getCourseTeamStats(course);
            const isExpanded = expandedCourseIds.includes(course.id);

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
              >
                {/* 課程列表主列 */}
                <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* 左側：課程名稱、類別與平台 */}
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-base hover:text-indigo-600 transition-colors">
                        {course.title}
                      </span>
                      {course.category && (
                        <Badge variant="outline" className="text-[11px] bg-indigo-50/80 text-indigo-700 border-indigo-200 font-medium">
                          {course.category}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">講師/平台：</span>
                        <span className="text-indigo-600 font-medium">{course.instructorOrPlatform}</span>
                      </div>

                      {(course.startDate || course.endDate) && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {course.startDate || '未定'} ~ {course.endDate || '未定'}
                          </span>
                        </div>
                      )}

                      {course.externalUrl && (
                        <a
                          href={course.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>課程傳送門 ↗</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 中間：指派成員頭像清單 */}
                  <div className="min-w-[180px] space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>指派成員 ({course.assignedUserIds.length} 位)：</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {course.assignedUserIds.map((uid) => {
                        const prog = course.memberProgress[uid];
                        const name = prog?.userName || course.assignedUserNames[course.assignedUserIds.indexOf(uid)] || '成員';
                        const percent = prog?.progressPercent ?? 0;
                        const isDone = prog?.isCompleted || percent >= 100;

                        return (
                          <button
                            key={uid}
                            type="button"
                            onClick={() => onSelectMemberInPersonalView(uid)}
                            title={`點擊切換查看 ${name} 的個人工作區 (達成率: ${percent}%)`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : percent > 0
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span>{name}</span>
                            <span className="font-bold text-[10px]">
                              {isDone ? '✓' : `${percent}%`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 右側：團隊整體完成率進度條與數值 */}
                  <div className="w-full lg:w-48 space-y-1.5 shrink-0 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">團隊整體完成率</span>
                      <span className={`font-bold ${stats.avgPercent >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {stats.avgPercent}%
                      </span>
                    </div>
                    <Progress
                      value={stats.avgPercent}
                      className={`h-2 ${stats.avgPercent >= 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100'}`}
                    />
                    <div className="text-[10px] text-slate-400 text-right">
                      {stats.completedCount} / {stats.totalCount} 位已完訓
                    </div>
                  </div>

                  {/* 操作與展開按鈕 */}
                  <div className="flex items-center gap-1 self-end lg:self-center">
                    {canUserEditCourse(currentUser, course.createdBy) && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditCourse(course)}
                          className="h-8 px-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                          title="編輯課程資訊 (主管理員/建立者可修改內容)"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(course.id, course.title)}
                          className="h-8 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="刪除課程"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(course.id)}
                      className="h-8 px-2.5 text-xs text-slate-700 gap-1"
                    >
                      <span>成員明細</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* 展開之受訓成員細節區塊 */}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200/80 p-4 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>📌 各成員進度、檢核待辦與心得摘要：</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        點選成員卡片可直接跳轉至個人專屬工作區
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {course.assignedUserIds.map((uid) => {
                        const prog = course.memberProgress[uid];
                        const name =
                          prog?.userName ||
                          course.assignedUserNames[course.assignedUserIds.indexOf(uid)] ||
                          '成員';
                        const percent = prog?.progressPercent ?? 0;
                        const isDone = prog?.isCompleted || percent >= 100;
                        const checklist = prog?.checklist || [];
                        const completedChecks = checklist.filter((c) => c.completed).length;

                        return (
                          <div
                            key={uid}
                            className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 hover:border-indigo-300 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                  {name.slice(0, 1)}
                                </div>
                                <span className="font-bold text-xs text-slate-800">{name}</span>
                              </div>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : percent > 0
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {isDone ? '已結訓' : `進行中 ${percent}%`}
                              </span>
                            </div>

                            <Progress value={percent} className="h-1.5" />

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                                檢核項: {completedChecks}/{checklist.length}
                              </span>
                              {prog?.attachments && prog.attachments.length > 0 && (
                                <span className="flex items-center gap-1 text-indigo-600">
                                  <Paperclip className="h-3 w-3" />
                                  {prog.attachments.length} 個附件
                                </span>
                              )}
                            </div>

                            {/* 心得摘錄 */}
                            {prog?.notes && (
                              <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600 line-clamp-2 border border-slate-100">
                                💬 {prog.notes.replace(/[#*`>-]/g, '').trim()}
                              </div>
                            )}

                            <div className="pt-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectMemberInPersonalView(uid)}
                                className="h-6 text-[11px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 font-medium"
                              >
                                進入個人工作區 ↗
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 視角二：進度看板呈現 (Kanban Mode) */}
      {displayMode === 'kanban' && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 欄位 1: 待開始 (0%) */}
          <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                待啟動 / 待開始
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {filteredCourses.filter((c) => getCourseTeamStats(c).avgPercent === 0).length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredCourses
                .filter((c) => getCourseTeamStats(c).avgPercent === 0)
                .map((course) => (
                  <KanbanCourseCard
                    key={course.id}
                    course={course}
                    stats={getCourseTeamStats(course)}
                    canEdit={canUserEditCourse(currentUser, course.createdBy)}
                    onEdit={() => onEditCourse(course)}
                    onDelete={() => handleDelete(course.id, course.title)}
                    onSelectMember={onSelectMemberInPersonalView}
                  />
                ))}
            </div>
          </div>

          {/* 欄位 2: 推進中 (1% ~ 99%) */}
          <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                團隊積極推進中 (進行中)
              </span>
              <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-200">
                {filteredCourses.filter((c) => {
                  const p = getCourseTeamStats(c).avgPercent;
                  return p > 0 && p < 100;
                }).length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredCourses
                .filter((c) => {
                  const p = getCourseTeamStats(c).avgPercent;
                  return p > 0 && p < 100;
                })
                .map((course) => (
                  <KanbanCourseCard
                    key={course.id}
                    course={course}
                    stats={getCourseTeamStats(course)}
                    canEdit={canUserEditCourse(currentUser, course.createdBy)}
                    onEdit={() => onEditCourse(course)}
                    onDelete={() => handleDelete(course.id, course.title)}
                    onSelectMember={onSelectMemberInPersonalView}
                  />
                ))}
            </div>
          </div>

          {/* 欄位 3: 已結訓 (100%) */}
          <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                全體完訓結案 (100%)
              </span>
              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                {filteredCourses.filter((c) => getCourseTeamStats(c).avgPercent >= 100).length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredCourses
                .filter((c) => getCourseTeamStats(c).avgPercent >= 100)
                .map((course) => (
                  <KanbanCourseCard
                    key={course.id}
                    course={course}
                    stats={getCourseTeamStats(course)}
                    canEdit={canUserEditCourse(currentUser, course.createdBy)}
                    onEdit={() => onEditCourse(course)}
                    onDelete={() => handleDelete(course.id, course.title)}
                    onSelectMember={onSelectMemberInPersonalView}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 看板單卡元件
function KanbanCourseCard({
  course,
  stats,
  canEdit,
  onEdit,
  onDelete,
  onSelectMember,
}: {
  course: PMLearningCourse;
  stats: { avgPercent: number; completedCount: number; totalCount: number };
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSelectMember: (uid: string) => void;
}) {
  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5">
      <div className="flex items-start justify-between gap-1.5">
        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
          {course.category || '專案管理'}
        </Badge>
        {canEdit && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              className="text-slate-400 hover:text-indigo-600 p-1 rounded"
              title="編輯課程"
            >
              <Edit3 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-slate-400 hover:text-rose-600 p-1 rounded"
              title="刪除課程"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
        {course.title}
      </h4>

      <div className="text-[11px] text-slate-500 flex items-center justify-between">
        <span className="truncate max-w-[140px]">{course.instructorOrPlatform}</span>
        {course.externalUrl && (
          <a
            href={course.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-0.5"
          >
            傳送門 <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-medium">達成率:</span>
          <span className="font-bold text-indigo-600">{stats.avgPercent}%</span>
        </div>
        <Progress value={stats.avgPercent} className="h-1.5" />
      </div>

      {/* 指派人員頭像 */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
        {course.assignedUserIds.map((uid) => {
          const prog = course.memberProgress[uid];
          const name = prog?.userName || '成員';
          const p = prog?.progressPercent ?? 0;
          return (
            <button
              key={uid}
              type="button"
              onClick={() => onSelectMember(uid)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors"
              title={`${name} 達成率 ${p}%`}
            >
              {name} ({p}%)
            </button>
          );
        })}
      </div>
    </div>
  );
}
