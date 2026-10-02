'use client';

import React, { useState, useMemo } from 'react';
import {
  PMLearningCourse,
  PMTeamDisplayMode,
  PMLearningContentType,
  CONTENT_TYPE_CONFIG,
} from '@/types/pm-learning';
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
  Tag,
  Video,
  Bookmark,
  Zap,
  Bot,
  X,
  RotateCcw,
} from 'lucide-react';
import { deletePMLearningCourse } from '@/lib/pm-learning-actions';
import { isCourseManager, canUserEditCourse } from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';
import { MarkdownPreview } from './markdown-preview';
import { ArticleReaderDialog } from './article-reader-dialog';

interface TeamViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  currentUser?: CurrentUser | null;
  categories?: string[];
  onOpenCategoryManager?: () => void;
  onOpenCreateDialog: (defaultUserId?: string, initialType?: PMLearningContentType) => void;
  onEditCourse: (course: PMLearningCourse) => void;
  onCourseDeleted: (courseId: string) => void;
  onSelectMemberInPersonalView: (userId: string) => void;
  onCourseUpdated?: (course: PMLearningCourse) => void;
}

export function TeamView({
  courses,
  pmoMembers,
  currentUser,
  categories,
  onOpenCategoryManager,
  onOpenCreateDialog,
  onEditCourse,
  onCourseDeleted,
  onSelectMemberInPersonalView,
  onCourseUpdated,
}: TeamViewProps) {
  const { toast } = useToast();
  const [displayMode, setDisplayMode] = useState<PMTeamDisplayMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContentType, setSelectedContentType] = useState<'all' | PMLearningContentType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('?券');
  const [selectedIssueDate, setSelectedIssueDate] = useState<string>('?券');
  const [selectedTimeliness, setSelectedTimeliness] = useState<string>('?券');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[]>([]);

  // ?亥???瘝絡撘霈閬????  const [readerCourse, setReaderCourse] = useState<PMLearningCourse | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const handleOpenReader = (c: PMLearningCourse) => {
    setReaderCourse(c);
    setIsReaderOpen(true);
  };

  // 撅?/?嗅??桀?????⊥?蝝?  const toggleExpand = (courseId: string) => {
    setExpandedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // 閮?瘥?摮貊?鞈????像????
  const getCourseTeamStats = (course: PMLearningCourse) => {
    const assignedIds = course.assignedUserIds || [];
    if (assignedIds.length === 0) {
      return { avgPercent: 0, completedCount: 0, totalCount: 0 };
    }
    let totalPercent = 0;
    let completedCount = 0;
    assignedIds.forEach((uid) => {
      const prog = (course.memberProgress || {})[uid];
      const p = prog?.progressPercent ?? 0;
      totalPercent += p;
      if (prog?.isCompleted || p >= 100) {
        completedCount++;
      }
    });
    const avgPercent = Math.round(totalPercent / assignedIds.length);
    return { avgPercent, completedCount, totalCount: assignedIds.length };
  };

  // ?典??蜇擃?KPI
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

  // ??擃?絞閮?  const contentTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: courses.length, course: 0, article: 0, video: 0, book: 0 };
    courses.forEach((c) => {
      const t = c.type || 'course';
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [courses]);

  // ???典?僑???(??撠)
  const allIssueDates = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.issueDate?.trim()) {
        const ym = c.issueDate.trim().substring(0, 7);
        set.add(ym);
      }
    });
    return ['?券', ...Array.from(set).sort().reverse()];
  }, [courses]);

  // ???憿??  const allCategories = useMemo(() => {
    const set = new Set<string>(categories || []);
    courses.forEach((c) => {
      if (c.category?.trim()) set.add(c.category.trim());
    });
    return ['?券', ...Array.from(set)];
  }, [courses, categories]);

  // 蝭拚??文?
  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedContentType !== 'all' ||
    selectedCategory !== '?券' ||
    selectedIssueDate !== '?券' ||
    selectedTimeliness !== '?券' ||
    selectedMemberFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedContentType('all');
    setSelectedCategory('?券');
    setSelectedIssueDate('?券');
    setSelectedTimeliness('?券');
    setSelectedMemberFilter('all');
  };

  // 蝭拚敺???  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 0. 頛???蝭拚
      if (selectedContentType !== 'all' && (course.type || 'course') !== selectedContentType) {
        return false;
      }

      // 1. ?摮?撠?      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchTitle = (course.title || '').toLowerCase().includes(q);
        const matchInstructor = (course.instructorOrPlatform || '').toLowerCase().includes(q);
        const matchSource = (course.source || '').toLowerCase().includes(q);
        const matchSubSource = (course.subSource || '').toLowerCase().includes(q);
        const matchDesc = (course.description || '').toLowerCase().includes(q);
        const matchContent = (course.content || '').toLowerCase().includes(q);
        const matchIssue = (course.issueDate || '').toLowerCase().includes(q);
        const matchMembers = (Array.isArray(course.assignedUserNames) ? course.assignedUserNames : []).some(
          (n) => (n || '').toLowerCase().includes(q)
        );
        if (
          !matchTitle &&
          !matchInstructor &&
          !matchSource &&
          !matchSubSource &&
          !matchDesc &&
          !matchContent &&
          !matchIssue &&
          !matchMembers
        ) {
          return false;
        }
      }

      // 2. ??瘥? (?詨?銝駁??券)
      if (selectedCategory !== '?券' && course.category !== selectedCategory) {
        return false;
      }

      // 3. ?箏?撟湔?瘥? (??撠惇)
      if (selectedIssueDate !== '?券') {
        const ym = (course.issueDate || '').trim().substring(0, 7);
        if (ym !== selectedIssueDate) return false;
      }

      // 4. ???扳?撠?      if (selectedTimeliness !== '?券') {
        if (selectedTimeliness === 'time_sensitive' && course.timelinessType !== 'time_sensitive') {
          return false;
        }
        if (selectedTimeliness === 'evergreen' && course.timelinessType !== 'evergreen') {
          return false;
        }
      }

      // 5. ?蝭拚瘥?
      if (selectedMemberFilter !== 'all' && !(course.assignedUserIds || []).includes(selectedMemberFilter)) {
        return false;
      }

      return true;
    });
  }, [
    courses,
    searchQuery,
    selectedContentType,
    selectedCategory,
    selectedIssueDate,
    selectedTimeliness,
    selectedMemberFilter,
  ]);

  // ?芷蝣箄?
  const handleDelete = async (courseId: string, title: string) => {
    if (!window.confirm(`蝣箏?閬?扎?{title}?飛蝧??桀?嚗迨???⊥?敺拙??)) {
      return;
    }
    try {
      const res = await deletePMLearningCourse(courseId);
      if (res.success) {
        toast({ title: '撌脣?日???, description: `???{title}?歇??蝘駁` });
        onCourseDeleted(courseId);
      } else {
        toast({ title: '?芷憭望?', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '?芷?粹', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ??蝮賡???? (KPI Summary Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">蝮賢飛蝧??亥?摨?/span>
            <BookOpen className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{teamOverallKPI.totalCourses}</div>
          <div className="text-[11px] text-slate-400 mt-1">瘨菔?隤脩???蝡蔣?唾?敹?</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-xs font-semibold">???湧?撟喳?????/span>
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-700">{teamOverallKPI.overallAvgPercent}%</span>
            <span className="text-xs text-blue-600/80">({courses.length} ???桀像??</span>
          </div>
          <div className="mt-2">
            <Progress value={teamOverallKPI.overallAvgPercent} className="h-1.5 bg-blue-100" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-semibold">撌脩?閮?/ 摰?鈭箸活</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{teamOverallKPI.totalCertifications}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">?犖?脣漲??100% 銋蜇閮?/div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-semibold">蝛扔?券脖葉?</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{teamOverallKPI.inProgressCourses}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">???典??靽桃???銝?/div>
        </div>
      </div>

      {/* ?之頛???????(?券 | 蝺?隤脩? | ?亥??? | 敶梢鞈? | ?犖?梯?) */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSelectedContentType('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedContentType === 'all'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>?? ?券頛?</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700">
              {contentTypeCounts.all}
            </span>
          </button>

          {(['course', 'article', 'video', 'book'] as PMLearningContentType[]).map((type) => {
            const cfg = CONTENT_TYPE_CONFIG[type];
            const count = contentTypeCounts[type] || 0;
            const isSelected = selectedContentType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedContentType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ?敹急?啣??? */}
        <div className="flex items-center gap-2">
          {onOpenCategoryManager && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCategoryManager}
              className="h-8 px-2.5 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 shadow-2xs hidden sm:flex"
              title="蝬剛風?憓?蝺刻摩??皜"
            >
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>蝬剛風??</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() =>
              onOpenCreateDialog(
                undefined,
                selectedContentType !== 'all' ? selectedContentType : 'course'
              )
            }
            className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>
              {selectedContentType === 'article'
                ? '?啣??亥???'
                : selectedContentType === 'video'
                ? '?啣?敶梢鞈?'
                : selectedContentType === 'book'
                ? '?啣??梯??貊'
                : '?啣??寡?? / ?晷'}
            </span>
          </Button>
        </div>
      </div>

      {/* ?券??敹恍?蝐文? (Category Quick Pills - 頝冽?隞質楊?箏??券??單) */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-indigo-600" />
          銝駁????券:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ???祟?貉?璅∪???撌亙??*/}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* ?摮?撠?*/}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="???迂??甈?雓葦????交??..."
              className="pl-9 pr-7 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="皜?摮?
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* ?箏??遢/?銝? (??撠) */}
          {(selectedContentType === 'all' || selectedContentType === 'article') &&
            allIssueDates.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500 hidden sm:inline" />
                <select
                  value={selectedIssueDate}
                  onChange={(e) => setSelectedIssueDate(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="?券">?券?箏??遢</option>
                  {allIssueDates
                    .filter((d) => d !== '?券')
                    .map((d) => (
                      <option key={d} value={d}>
                        ?? ?箏?: {d}
                      </option>
                    ))}
                </select>
              </div>
            )}

          {/* ???扯釭銝? */}
          {(selectedContentType === 'all' || selectedContentType === 'article') && (
            <select
              value={selectedTimeliness}
              onChange={(e) => setSelectedTimeliness(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="?券">?券????/option>
              <option value="time_sensitive">????頞典 (餈??)</option>
              <option value="evergreen">? 撣賊??亥? (?瑟??拍)</option>
            </select>
          )}

          {/* ?蝭拚 */}
          <select
            value={selectedMemberFilter}
            onChange={(e) => setSelectedMemberFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">???瘣暹???/option>
            {(pmoMembers || []).map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName || m.email}
              </option>
            ))}
          </select>

          {/* ?身蝭拚?? */}
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800 gap-1"
              title="皜??祟?豢?隞?
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>?身</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* 閬????? ?” vs ? */}
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
              <span>?”?</span>
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
              <span>?脣漲?</span>
            </button>
          </div>

          {/* 銝餌恣?甈??內 */}
          {isCourseManager(currentUser) && (
            <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs gap-1 font-semibold hidden lg:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              <span>蝞∠??⊥???/span>
            </Badge>
          )}
        </div>
      </div>

      {/* ?亦蝯??內 */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">?曆??啁泵??隞嗥??</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            閰西??湔?蝭拚璇辣???日??萄?嚗?暺?銝???啣?摮貊????          </p>
          {isFiltered && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs"
            >
              皜??祟?豢?隞?            </Button>
          )}
        </div>
      )}

      {/* 閬?銝嚗?銵典???(List / Table Mode) */}
      {displayMode === 'list' && filteredCourses.length > 0 && (
        <div className="space-y-3">
          {filteredCourses.map((course) => {
            const stats = getCourseTeamStats(course);
            const isExpanded = expandedCourseIds.includes(course.id);
            const carrierType = course.type || 'course';
            const carrierCfg = CONTENT_TYPE_CONFIG[carrierType] || CONTENT_TYPE_CONFIG['course'];
            const isArticle = carrierType === 'article';

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
              >
                {/* ?”銝餃? */}
                <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* 撌血嚗?擃?蝔晞??亥?撟喳 */}
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 頛?璅惜 */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${carrierCfg.badgeClass}`}
                      >
                        <span>{carrierCfg.icon}</span>
                        <span>{carrierCfg.label}</span>
                      </span>

                      {/* ?箏?撟湔? (??) */}
                      {course.issueDate && (
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-slate-50 text-slate-700 border-slate-200 font-mono gap-1"
                        >
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>{course.issueDate.substring(0, 7)}</span>
                        </Badge>
                      )}

                      {/* ??璅惜 */}
                      {course.timelinessType === 'time_sensitive' && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Zap className="h-3 w-3 text-amber-500" />
                          ??
                        </span>
                      )}

                      {/* ??璅惜 */}
                      {course.category && (
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-indigo-50/80 text-indigo-700 border-indigo-200 font-medium"
                        >
                          {course.category}
                        </Badge>
                      )}

                      <span className="font-bold text-slate-900 text-base hover:text-indigo-600 transition-colors">
                        {course.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">
                          {isArticle ? '撠?/靘?嚗? : carrierType === 'video' ? '敶梢撟喳嚗? : carrierType === 'book' ? '雿??箇?嚗? : '雓葦/撟喳嚗?}
                        </span>
                        <span className="text-indigo-600 font-medium">
                          {course.source || course.instructorOrPlatform}
                          {course.subSource ? ` 繚 ${course.subSource}` : ''}
                        </span>
                      </div>

                      {(course.startDate || course.endDate) && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {course.startDate || '?芸?'} ~ {course.endDate || '?芸?'}
                          </span>
                        </div>
                      )}

                      {/* ?梯??冽??? (????) */}
                      {isArticle && (
                        <button
                          type="button"
                          onClick={() => handleOpenReader(course)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
                        >
                          <FileText className="h-3.5 w-3.5 text-indigo-600" />
                          <span>?梯??冽?</span>
                          {course.aiAnalysis && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold ml-0.5">
                              ?? AI ??
                            </span>
                          )}
                        </button>
                      )}

                      {/* 憭?喲? */}
                      {course.externalUrl && (
                        <a
                          href={course.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>
                            {isArticle ? '???? ?? : carrierType === 'video' ? '閫?蔣???? : '憭?喲? ??}
                          </span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 銝剝?嚗?瘣暹??⊿????*/}
                  <div className="min-w-[180px] space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>?晷? ({(course.assignedUserIds || []).length} 雿?嚗?/span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(course.assignedUserIds || []).map((uid) => {
                        const prog = (course.memberProgress || {})[uid];
                        const name =
                          prog?.userName ||
                          (course.assignedUserNames || [])[(course.assignedUserIds || []).indexOf(uid)] ||
                          '?';
                        const percent = prog?.progressPercent ?? 0;
                        const isDone = prog?.isCompleted || percent >= 100;

                        return (
                          <button
                            key={uid}
                            type="button"
                            onClick={() => onSelectMemberInPersonalView(uid)}
                            title={`暺????亦? ${name} ?犖撌乩?? (???? ${percent}%)`}
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
                              {isDone ? '?? : `${percent}%`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ?喳嚗??擃????脣漲璇??詨?*/}
                  <div className="w-full lg:w-48 space-y-1.5 shrink-0 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">???湧?摰???/span>
                      <span
                        className={`font-bold ${
                          stats.avgPercent >= 100 ? 'text-emerald-600' : 'text-indigo-600'
                        }`}
                      >
                        {stats.avgPercent}%
                      </span>
                    </div>
                    <Progress
                      value={stats.avgPercent}
                      className={`h-2 ${
                        stats.avgPercent >= 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100'
                      }`}
                    />
                    <div className="text-[10px] text-slate-400 text-right">
                      {stats.completedCount} / {stats.totalCount} 雿歇摰?/摰?
                    </div>
                  </div>

                  {/* ????????*/}
                  <div className="flex items-center gap-1 self-end lg:self-center">
                    {canUserEditCourse(currentUser, course.createdBy) && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditCourse(course)}
                          className="h-8 px-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                          title="蝺刻摩?批捆 (銝餌恣?/撱箇??靽格?批捆)"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(course.id, course.title)}
                          className="h-8 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="?芷?"
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
                      <span>??敦</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* 撅?銋?閮??∠敦蝭?憛?*/}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200/80 p-4 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>?? ???⊿脣漲?炎?詨?颲西?敹???嚗?/span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        暺??∠??舐?亥歲頧?犖撠惇撌乩??
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(course.assignedUserIds || []).map((uid) => {
                        const prog = (course.memberProgress || {})[uid];
                        const name =
                          prog?.userName ||
                          (course.assignedUserNames || [])[(course.assignedUserIds || []).indexOf(uid)] ||
                          '?';
                        const percent = prog?.progressPercent ?? 0;
                        const isDone = prog?.isCompleted || percent >= 100;
                        const checklist = Array.isArray(prog?.checklist) ? prog.checklist : [];
                        const completedChecks = checklist.filter((c) => c?.completed).length;

                        return (
                          <div
                            key={uid}
                            className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 hover:border-indigo-300 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                  {String(name || 'PM').slice(0, 1)}
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
                                {isDone ? '撌脩?閮? : `?脰?銝?${percent}%`}
                              </span>
                            </div>

                            <Progress value={percent} className="h-1.5" />

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                                蝡??桀?: {completedChecks}/{checklist.length}
                              </span>
                              {Array.isArray(prog?.attachments) && prog.attachments.length > 0 && (
                                <span className="flex items-center gap-1 text-indigo-600">
                                  <Paperclip className="h-3 w-3" />
                                  {prog.attachments.length} ??隞?                                </span>
                              )}
                            </div>

                            {/* 敹??? */}
                            {prog?.notes && typeof prog.notes === 'string' && (
                              <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600 line-clamp-2 border border-slate-100">
                                ? {prog.notes.replace(/[#*`>-]/g, '').trim()}
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
                                ?脣?犖撌乩?? ??                              </Button>
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

      {/* 閬?鈭??脣漲?? (Kanban Mode) */}
      {displayMode === 'kanban' && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 甈? 1: 敺?憪?(0%) */}
          <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                敺???/ 敺?憪?              </span>
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
                    onOpenReader={handleOpenReader}
                  />
                ))}
            </div>
          </div>

          {/* 甈? 2: ?券脖葉 (1% ~ 99%) */}
          <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                ??蝛扔?券脖葉 (?脰?銝?
              </span>
              <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-200">
                {
                  filteredCourses.filter((c) => {
                    const p = getCourseTeamStats(c).avgPercent;
                    return p > 0 && p < 100;
                  }).length
                }
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
                    onOpenReader={handleOpenReader}
                  />
                ))}
            </div>
          </div>

          {/* 甈? 3: 撌脩?閮?(100%) */}
          <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                ?券?摰?蝯? (100%)
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
                    onOpenReader={handleOpenReader}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ?亥???瘝絡撘霈閬? (?舀 AI ????閮? */}
      <ArticleReaderDialog
        isOpen={isReaderOpen}
        onClose={() => {
          setIsReaderOpen(false);
          setReaderCourse(null);
        }}
        course={readerCourse}
        currentUserId={currentUser?.uid}
        onEdit={(c) => {
          setIsReaderOpen(false);
          onEditCourse(c);
        }}
        onCourseUpdated={(c) => {
          setReaderCourse(c);
          if (onCourseUpdated) onCourseUpdated(c);
        }}
      />
    </div>
  );
}

// ??桀?辣
function KanbanCourseCard({
  course,
  stats,
  canEdit,
  onEdit,
  onDelete,
  onSelectMember,
  onOpenReader,
}: {
  course: PMLearningCourse;
  stats: { avgPercent: number; completedCount: number; totalCount: number };
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSelectMember: (uid: string) => void;
  onOpenReader: (course: PMLearningCourse) => void;
}) {
  const carrierType = course.type || 'course';
  const carrierCfg = CONTENT_TYPE_CONFIG[carrierType] || CONTENT_TYPE_CONFIG['course'];
  const isArticle = carrierType === 'article';

  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5">
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border ${carrierCfg.badgeClass}`}
          >
            <span>{carrierCfg.icon}</span>
            <span>{carrierCfg.label}</span>
          </span>

          {course.issueDate && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono">
              {course.issueDate.substring(0, 7)}
            </span>
          )}

          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
            {course.category || '撠?蝞∠?'}
          </Badge>
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="text-slate-400 hover:text-indigo-600 p-1 rounded"
              title="蝺刻摩?"
            >
              <Edit3 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-slate-400 hover:text-rose-600 p-1 rounded"
              title="?芷?"
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
        <span className="truncate max-w-[140px]" title={[course.source || course.instructorOrPlatform, course.subSource].filter(Boolean).join(' 繚 ')}>
          {course.source || course.instructorOrPlatform}
          {course.subSource ? ` 繚 ${course.subSource}` : ''}
        </span>

        {isArticle ? (
          <button
            type="button"
            onClick={() => onOpenReader(course)}
            className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5 text-[11px]"
          >
            <FileText className="h-3 w-3 text-indigo-600" />
            ?梯??冽?
          </button>
        ) : course.externalUrl ? (
          <a
            href={course.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-0.5"
          >
            ?喲? <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-medium">????</span>
          <span className="font-bold text-indigo-600">{stats.avgPercent}%</span>
        </div>
        <Progress value={stats.avgPercent} className="h-1.5" />
      </div>

      {/* ?晷鈭箏?剖? */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
        {(course.assignedUserIds || []).map((uid) => {
          const prog = (course.memberProgress || {})[uid];
          const name = prog?.userName || '?';
          const p = prog?.progressPercent ?? 0;
          return (
            <button
              key={uid}
              type="button"
              onClick={() => onSelectMember(uid)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors"
              title={`${name} ????${p}%`}
            >
              {name} ({p}%)
            </button>
          );
        })}
      </div>
    </div>
  );
}
