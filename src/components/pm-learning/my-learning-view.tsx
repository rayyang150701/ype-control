'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PMLearningCourse,
  PMLearningMemberProgress,
  PMLearningChecklistItem,
  PMLearningAttachment,
  PMLearningContentType,
  PMLearningTimelinessType,
  CONTENT_TYPE_CONFIG,
} from '@/types/pm-learning';
import { User, CurrentUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Award,
  User as UserIcon,
  Plus,
  Trash2,
  Edit3,
  Save,
  Paperclip,
  FileText,
  RotateCcw,
  CheckSquare,
  Calculator,
  ChevronDown,
  ChevronUp,
  Layers,
  Link as LinkIcon,
  ShieldCheck,
  Tag,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Search,
  Filter,
  Bot,
  Zap,
  Bookmark,
  Video,
} from 'lucide-react';
import {
  updatePMMemberProgress,
  deletePMLearningCourse,
  saveUserCourseOrder,
  updateCourseHours,
} from '@/lib/pm-learning-actions';
import { isCourseManager, canUserEditCourse } from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';
import { MarkdownPreview } from './markdown-preview';
import { ArticleReaderDialog } from './article-reader-dialog';

interface MyLearningViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  activeUserId: string;
  onActiveUserIdChange: (userId: string) => void;
  currentUser?: CurrentUser | null;
  categories?: string[];
  onOpenCategoryManager?: () => void;
  onCourseUpdated: (course: PMLearningCourse) => void;
  onOpenCreateDialog: (defaultUserId?: string, initialType?: PMLearningContentType) => void;
  onEditCourse: (course: PMLearningCourse) => void;
  onCourseDeleted: (courseId: string) => void;
}

export function MyLearningView({
  courses,
  pmoMembers,
  activeUserId,
  onActiveUserIdChange,
  currentUser,
  categories,
  onOpenCategoryManager,
  onCourseUpdated,
  onOpenCreateDialog,
  onEditCourse,
  onCourseDeleted,
}: MyLearningViewProps) {
  const { toast } = useToast();

  // 目前選中的億威 PMO 成員
  const activeMember = (pmoMembers || []).find((m) => m.uid === activeUserId) || pmoMembers?.[0];

  // 篩選指派給該成員的課程清單
  const myCourses = (courses || []).filter((c) => (c.assignedUserIds || []).includes(activeMember?.uid || ''));

  // 計算該成員個人的整體學習與時數數據
  const personalStats = useMemo(() => {
    if (myCourses.length === 0 || !activeMember) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        avgPercent: 0,
        totalHours: 0,
        completedHours: 0,
        hoursPercent: 0,
      };
    }
    let totalP = 0;
    let completedC = 0;
    let inProgressC = 0;
    let totalH = 0;
    let completedH = 0;

    myCourses.forEach((c) => {
      const h = Number(c.hours) || 0;
      totalH += h;

      const prog = (c.memberProgress || {})[activeMember?.uid || ''];
      const p = prog?.progressPercent ?? 0;
      totalP += p;
      if (prog?.isCompleted || p >= 100) {
        completedC++;
        completedH += h;
      } else if (p > 0) {
        inProgressC++;
      }
    });

    const hoursPct = totalH > 0 ? Math.round((completedH / totalH) * 100) : 0;

    return {
      total: myCourses.length,
      completed: completedC,
      inProgress: inProgressC,
      avgPercent: Math.round(totalP / myCourses.length),
      totalHours: totalH,
      completedHours: completedH,
      hoursPercent: hoursPct,
    };
  }, [myCourses, activeMember]);

  // 依該成員個人自訂順序 (sortOrder) 排序課程
  const sortedMyCourses = useMemo(() => {
    const uid = activeMember?.uid || '';
    return [...myCourses].sort((a, b) => {
      const orderA = (a.memberProgress || {})[uid]?.sortOrder;
      const orderB = (b.memberProgress || {})[uid]?.sortOrder;
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return 0;
    });
  }, [myCourses, activeMember?.uid]);

  // 全域展開/收合控制
  const [expandAllState, setExpandAllState] = useState<boolean>(false);

  // 載體型態切換分頁 (全部 | 課程 | 文章 | 影音 | 閱讀)
  const [selectedContentType, setSelectedContentType] = useState<'all' | PMLearningContentType>('all');
  const [selectedIssueDate, setSelectedIssueDate] = useState<string>('全部');
  const [selectedTimeliness, setSelectedTimeliness] = useState<string>('全部');

  // 文章閱讀視窗狀態
  const [readerCourse, setReaderCourse] = useState<PMLearningCourse | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const handleOpenReader = (c: PMLearningCourse) => {
    setReaderCourse(c);
    setIsReaderOpen(true);
  };

  // 篩選與搜尋狀態 (關鍵字查詢、課程領域、平台/講師、學習狀態)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('全部');
  const [selectedStatus, setSelectedStatus] = useState<string>('全部');

  // 各載體數量統計
  const contentTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: myCourses.length, course: 0, article: 0, video: 0, book: 0 };
    myCourses.forEach((c) => {
      const t = c.type || 'course';
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [myCourses]);

  // 所有可用出刊年月選項 (文章專用)
  const allIssueDates = useMemo(() => {
    const set = new Set<string>();
    myCourses.forEach((c) => {
      if (c.issueDate?.trim()) {
        const ym = c.issueDate.trim().substring(0, 7);
        set.add(ym);
      }
    });
    return ['全部', ...Array.from(set).sort().reverse()];
  }, [myCourses]);

  // 所有可用領域選項
  const allCategories = useMemo(() => {
    const set = new Set<string>(categories || []);
    myCourses.forEach((c) => {
      if (c.category?.trim()) set.add(c.category.trim());
    });
    return ['全部', ...Array.from(set)];
  }, [myCourses, categories]);

  // 所有可用平台 / 專欄來源選項
  const allPlatforms = useMemo(() => {
    const set = new Set<string>();
    myCourses.forEach((c) => {
      const src = c.source || c.instructorOrPlatform;
      if (src?.trim()) {
        set.add(src.trim());
      }
      if (c.subSource?.trim()) {
        set.add(c.subSource.trim());
      }
    });
    return ['全部', ...Array.from(set)];
  }, [myCourses]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedContentType !== 'all' ||
    selectedCategory !== '全部' ||
    selectedIssueDate !== '全部' ||
    selectedTimeliness !== '全部' ||
    selectedPlatform !== '全部' ||
    selectedStatus !== '全部';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedContentType('all');
    setSelectedCategory('全部');
    setSelectedIssueDate('全部');
    setSelectedTimeliness('全部');
    setSelectedPlatform('全部');
    setSelectedStatus('全部');
  };

  // 篩選後課程清單 (同時保留自訂排序)
  const filteredCourses = useMemo(() => {
    return sortedMyCourses.filter((course) => {
      // 0. 載體型態篩選
      if (selectedContentType !== 'all' && (course.type || 'course') !== selectedContentType) {
        return false;
      }

      // 1. 關鍵字比對 (搜尋名稱、平台/講師、專欄、子主題、說明、筆記、章節單元、出刊、內文)
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const prog = (course.memberProgress || {})[activeMember?.uid || ''];
        const matchTitle = (course.title || '').toLowerCase().includes(q);
        const matchPlatform = (course.instructorOrPlatform || '').toLowerCase().includes(q);
        const matchSource = (course.source || '').toLowerCase().includes(q);
        const matchSubSource = (course.subSource || '').toLowerCase().includes(q);
        const matchDesc = (course.description || '').toLowerCase().includes(q);
        const matchCategory = (course.category || '').toLowerCase().includes(q);
        const matchContent = (course.content || '').toLowerCase().includes(q);
        const matchIssue = (course.issueDate || '').toLowerCase().includes(q);
        const matchNotes = (prog?.notes || '').toLowerCase().includes(q);
        const matchChecklist = (prog?.checklist || []).some((item) =>
          (item.title || '').toLowerCase().includes(q)
        );
        if (
          !matchTitle &&
          !matchPlatform &&
          !matchSource &&
          !matchSubSource &&
          !matchDesc &&
          !matchCategory &&
          !matchContent &&
          !matchIssue &&
          !matchNotes &&
          !matchChecklist
        ) {
          return false;
        }
      }

      // 2. 領域篩選 (保留隨選搜尋核心主題)
      if (selectedCategory !== '全部' && course.category !== selectedCategory) {
        return false;
      }

      // 3. 出刊年月篩選 (文章專屬)
      if (selectedIssueDate !== '全部') {
        const ym = (course.issueDate || '').trim().substring(0, 7);
        if (ym !== selectedIssueDate) return false;
      }

      // 4. 時效性篩選
      if (selectedTimeliness !== '全部') {
        if (selectedTimeliness === 'time_sensitive' && course.timelinessType !== 'time_sensitive') {
          return false;
        }
        if (selectedTimeliness === 'evergreen' && course.timelinessType !== 'evergreen') {
          return false;
        }
      }

      // 5. 平台 / 專欄來源篩選
      if (selectedPlatform !== '全部') {
        const p = selectedPlatform.toLowerCase();
        const matchP =
          (course.instructorOrPlatform || '').toLowerCase() === p ||
          (course.source || '').toLowerCase() === p ||
          (course.subSource || '').toLowerCase() === p;
        if (!matchP) {
          return false;
        }
      }

      // 6. 學習狀態篩選
      if (selectedStatus !== '全部') {
        const prog = (course.memberProgress || {})[activeMember?.uid || ''];
        const p = prog?.progressPercent ?? 0;
        const isDone = prog?.isCompleted || p >= 100;
        if (selectedStatus === '已完訓' && !isDone) return false;
        if (selectedStatus === '進行中' && (isDone || p === 0)) return false;
        if (selectedStatus === '待開始' && (isDone || p > 0)) return false;
      }

      return true;
    });
  }, [
    sortedMyCourses,
    searchQuery,
    selectedContentType,
    selectedCategory,
    selectedIssueDate,
    selectedTimeliness,
    selectedPlatform,
    selectedStatus,
    activeMember?.uid,
  ]);

  // 個人視角：上下移動調整課程順序並儲存
  const handleMoveCourse = async (courseId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedMyCourses.findIndex((c) => c.id === courseId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedMyCourses.length) return;

    const newOrdered = [...sortedMyCourses];
    const temp = newOrdered[currentIndex];
    newOrdered[currentIndex] = newOrdered[targetIndex];
    newOrdered[targetIndex] = temp;

    const orderedIds = newOrdered.map((c) => c.id);
    const activeUid = activeMember?.uid || '';

    // 立即更新前端各課程的 sortOrder 狀態
    newOrdered.forEach((c, idx) => {
      const existingProg = (c.memberProgress || {})[activeUid] || {
        userId: activeUid,
        userName: activeMember?.displayName || '',
        progressPercent: 0,
        isCompleted: false,
        checklist: [],
        attachments: [],
      };
      onCourseUpdated({
        ...c,
        memberProgress: {
          ...(c.memberProgress || {}),
          [activeUid]: {
            ...existingProg,
            sortOrder: idx,
          },
        },
      });
    });

    toast({
      title: '已調整課程順序',
      description: `已將課程向${direction === 'up' ? '上' : '下'}移動並儲存`,
    });

    try {
      if (activeMember?.uid) {
        await saveUserCourseOrder(activeMember.uid, orderedIds);
      }
    } catch (e: any) {
      console.error('儲存排序異常:', e);
      toast({ title: '排序雲端同步異常', description: e?.message, variant: 'destructive' });
    }
  };

  // 刪除課程處理
  const handleDeleteCourse = async (courseId: string, title: string) => {
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

  const isAdminOrJames = isCourseManager(currentUser);

  return (
    <div className="space-y-6">
      {/* 頂部人員切換與身分識別區 (限定億威電子 PMO 部門) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-linear-to-tr from-indigo-600 to-blue-500 text-white font-bold text-lg flex items-center justify-center shadow-2xs shrink-0">
            {(activeMember?.displayName || activeMember?.email || 'PM').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {activeMember?.displayName || activeMember?.email} 的個人工作區
              </h2>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                🏢 億威電子 · {activeMember?.department || 'PMO專案管理處'}
              </Badge>
              {isAdminOrJames && (
                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs gap-1 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                  <span>管理員編輯權限 (jamesyang / admin)</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              可點擊課程標題旁展開詳情、手動調整學習進度、維護時數、自訂上下移動排序。
            </p>
          </div>
        </div>

        {/* 右側操作群：切換成員 + 個人自行新增課程按鈕 */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
          {/* 人員切換下拉選單 */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <UserIcon className="h-4 w-4 text-slate-500 ml-1.5" />
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">切換成員:</span>
            <select
              value={activeMember?.uid}
              onChange={(e) => onActiveUserIdChange(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(pmoMembers || []).map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName || m.email} (億威 · {m.department || 'PM'})
                </option>
              ))}
            </select>
          </div>

          {/* 維護領域類別按鈕 */}
          {onOpenCategoryManager && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenCategoryManager}
              className="h-9 px-3 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1.5 shadow-2xs"
              title="維護、新增、編輯或重新命名課程領域清單"
            >
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>維護領域類別</span>
            </Button>
          )}

          {/* 個人自行新增課程按鈕 */}
          <Button
            type="button"
            onClick={() => onOpenCreateDialog(activeMember?.uid)}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-2xs"
            title="個人可自行新增自選學習課程，並自動納入個人工作區與團隊學習地圖"
          >
            <Plus className="h-4 w-4" />
            <span>+ 自行新增學習課程</span>
          </Button>
        </div>
      </div>

      {/* 個人成果與時數指標列 (Personal KPI Bar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-slate-500">已指派課程</span>
          <div className="text-xl font-bold text-slate-800 mt-0.5">
            {personalStats.total} 堂{' '}
            <span className="text-xs font-normal text-slate-400">({personalStats.totalHours} 小時)</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-blue-600">積極進行中</span>
          <div className="text-xl font-bold text-blue-600 mt-0.5">{personalStats.inProgress} 堂</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-emerald-600">已完訓結業</span>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {personalStats.completed} 堂{' '}
            <span className="text-xs font-normal text-emerald-600/80">({personalStats.completedHours}h)</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-600">個人總完訓率</span>
            <span className="text-xs font-bold text-indigo-700">
              {personalStats.avgPercent}%{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                (時數 {personalStats.hoursPercent}%)
              </span>
            </span>
          </div>
          <Progress value={personalStats.avgPercent} className="h-2 mt-2 bg-indigo-100" />
        </div>
      </div>

      {/* 無課程提示 */}
      {sortedMyCourses.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">
            目前尚未指派課程給 {activeMember?.displayName || activeMember?.email}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            您可以點擊上方「+ 自行新增學習課程」建立專屬進修項目，或切換至「主管 / 團隊視角 (Team View)」進行指派。
          </p>
          <Button
            type="button"
            onClick={() => onOpenCreateDialog(activeMember?.uid)}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            建立第一門自選學習課程
          </Button>
        </div>
      )}

      {/* 四大載體切換分頁 + 搜尋與篩選工具列 */}
      {sortedMyCourses.length > 0 && (
        <div className="space-y-3">
          {/* 1. 四大載體切換分頁列 (全部 | 線上課程 | 知識文章 | 影音資源 | 個人閱讀) */}
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
                <span>🌐 全部載體</span>
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

            {/* 新增項目快捷按鈕 */}
            <Button
              type="button"
              size="sm"
              onClick={() =>
                onOpenCreateDialog(
                  activeMember?.uid,
                  selectedContentType !== 'all' ? selectedContentType : 'course'
                )
              }
              className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {selectedContentType === 'article'
                  ? '新增知識文章'
                  : selectedContentType === 'video'
                  ? '新增影音資源'
                  : selectedContentType === 'book'
                  ? '新增閱讀筆記'
                  : '新增自選項目'}
              </span>
            </Button>
          </div>

          {/* 2. 隨選領域快速標籤列 (Category Quick Pills - 跨月份跨出刊隨點即查) */}
          <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              主題領域隨選:
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

          {/* 3. 關鍵字搜尋與細部下拉選單列 */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* 關鍵字搜尋 */}
              <div className="relative min-w-[200px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋標題、專欄/講師、內文、期別或筆記..."
                  className="pl-9 pr-7 h-9 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="清除關鍵字"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 出刊月份/期別下拉 (有文章或全部時顯示) */}
              {(selectedContentType === 'all' || selectedContentType === 'article') &&
                allIssueDates.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500 hidden sm:inline" />
                    <select
                      value={selectedIssueDate}
                      onChange={(e) => setSelectedIssueDate(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="全部">全部出刊月份</option>
                      {allIssueDates
                        .filter((d) => d !== '全部')
                        .map((d) => (
                          <option key={d} value={d}>
                            📅 出刊: {d}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

              {/* 時效性質下拉 (文章時顯示) */}
              {(selectedContentType === 'all' || selectedContentType === 'article') && (
                <select
                  value={selectedTimeliness}
                  onChange={(e) => setSelectedTimeliness(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="全部">全部時效性</option>
                  <option value="time_sensitive">⚡ 時效趨勢 (近期關鍵)</option>
                  <option value="evergreen">🌱 常青知識 (長期適用)</option>
                </select>
              )}

              {/* 平台 / 講師下拉篩選 */}
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="全部">全部來源 / 平台</option>
                  {allPlatforms
                    .filter((p) => p !== '全部')
                    .map((p) => (
                      <option key={p} value={p}>
                        來源: {p}
                      </option>
                    ))}
                </select>
              </div>

              {/* 學習狀態下拉篩選 */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="全部">全部修習狀態</option>
                <option value="進行中">⚡ 積極進行中</option>
                <option value="已完訓">✅ 已完訓結業</option>
                <option value="待開始">📌 尚未開始 (0%)</option>
              </select>

              {/* 重設篩選按鈕 */}
              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1 font-semibold"
                  title="重設所有篩選條件"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>清除篩選</span>
                </Button>
              )}
            </div>

            {/* 右側：全部展開 / 全部收合按鈕 */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpandAllState((prev) => !prev)}
                className="h-9 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold shadow-2xs"
              >
                {expandAllState ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>全部收合 ▴</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>全部展開 ▾</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 項目列表計數與提示 */}
      {sortedMyCourses.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span>
              已排定 PM 成長地圖項目 (
              {isFiltered ? (
                <span className="text-indigo-600 font-extrabold">
                  符合條件 {filteredCourses.length} / 全體 {sortedMyCourses.length} 筆
                </span>
              ) : (
                `${sortedMyCourses.length} 筆`
              )}
              )
            </span>
            <span className="text-slate-400 font-normal hidden sm:inline">
              · 可依領域標籤快速切換主題，文章支援點擊「閱讀全文」查看內文與 AI 分析
            </span>
          </div>

          {isFiltered && (
            <div className="text-xs text-slate-400">
              已套用篩選條件
            </div>
          )}
        </div>
      )}

      {/* 查無篩選結果提示 */}
      {sortedMyCourses.length > 0 && filteredCourses.length === 0 && (
        <div className="text-center py-14 bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
          <Filter className="h-9 w-9 text-slate-300 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-700">找不到符合篩選條件的學習項目</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            目前設定的關鍵字、領域標籤、月份或載體無匹配項目，請嘗試調整條件或點擊下方按鈕清除篩選。
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            清除所有篩選條件
          </Button>
        </div>
      )}

      {/* 個人卡片式呈現 */}
      <div className="space-y-4">
        {filteredCourses.map((course) => {
          const overallIndex = sortedMyCourses.findIndex((c) => c.id === course.id);
          const isFirst = overallIndex === 0;
          const isLast = overallIndex === sortedMyCourses.length - 1;

          return (
            <PersonalCardErrorBoundary key={course.id} courseTitle={course.title}>
              <PersonalCourseCard
                course={course}
                userId={activeMember?.uid || ''}
                currentUser={currentUser}
                isFirst={isFirst}
                isLast={isLast}
                defaultExpanded={expandAllState}
                onMoveCourse={(direction) => handleMoveCourse(course.id, direction)}
                onUpdateCourse={onCourseUpdated}
                onEditCourse={onEditCourse}
                onDeleteCourse={handleDeleteCourse}
                onOpenReader={handleOpenReader}
              />
            </PersonalCardErrorBoundary>
          );
        })}
      </div>

      {/* 知識文章沉浸式閱讀視窗 (支援 AI 摘要與筆記) */}
      <ArticleReaderDialog
        isOpen={isReaderOpen}
        onClose={() => {
          setIsReaderOpen(false);
          setReaderCourse(null);
        }}
        course={readerCourse}
        currentUserId={activeMember?.uid}
        onEdit={(c) => {
          setIsReaderOpen(false);
          onEditCourse(c);
        }}
        onCourseUpdated={(c) => {
          setReaderCourse(c);
          onCourseUpdated(c);
        }}
      />
    </div>
  );
}

// 單張卡片獨立 Error Boundary，杜絕單一卡片異常讓整頁崩潰，並精確定位問題卡片
class PersonalCardErrorBoundary extends React.Component<
  { courseTitle: string; children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { courseTitle: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`課程「${this.props.courseTitle}」卡片渲染異常:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-2.5 shadow-2xs my-2">
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-2 text-sm text-amber-900">
              <span className="p-1 rounded bg-amber-100 text-amber-700">⚠️</span>
              <span>課程「{this.props.courseTitle}」卡片渲染發生問題 (已安全隔離，其餘卡片正常運行)</span>
            </div>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-amber-200/60 font-mono text-[11px] text-rose-800 space-y-1">
            <p className="font-semibold">{this.state.error?.name}: {this.state.error?.message}</p>
            {this.state.errorInfo?.componentStack && (
              <pre className="text-[10px] text-slate-700 whitespace-pre-wrap max-h-36 overflow-y-auto mt-1 pt-1 border-t border-amber-200/40">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 單堂課程的個人專屬卡片元件 (支援折疊收合，進度%、日期、時數明確放於名稱旁)
function PersonalCourseCard({
  course,
  userId,
  currentUser,
  isFirst,
  isLast,
  defaultExpanded = false,
  onMoveCourse,
  onUpdateCourse,
  onEditCourse,
  onDeleteCourse,
  onOpenReader,
}: {
  course: PMLearningCourse;
  userId: string;
  currentUser?: CurrentUser | null;
  isFirst: boolean;
  isLast: boolean;
  defaultExpanded?: boolean;
  onMoveCourse: (direction: 'up' | 'down') => void;
  onUpdateCourse: (course: PMLearningCourse) => void;
  onEditCourse: (course: PMLearningCourse) => void;
  onDeleteCourse: (courseId: string, title: string) => void;
  onOpenReader: (course: PMLearningCourse) => void;
}) {
  const { toast } = useToast();
  const rawProgress = (course.memberProgress || {})[userId];
  const memberProgress: PMLearningMemberProgress = useMemo(() => {
    if (rawProgress) return rawProgress;
    return {
      userId,
      userName: '成員',
      progressPercent: 0,
      isCompleted: false,
      notes: '',
      checklist: (Array.isArray(course.defaultChecklist) ? course.defaultChecklist : []).map((item, idx) => ({
        id: `chk-${idx}`,
        title: item,
        completed: false,
      })),
      attachments: [],
    };
  }, [rawProgress, userId, course.defaultChecklist]);

  // 控制整張卡片下半部是否展開（使用者要求紅框下預設收起）
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(defaultExpanded);

  useEffect(() => {
    setIsCardExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const [progressVal, setProgressVal] = useState<number>(memberProgress.progressPercent || 0);
  const [isNotesEditing, setIsNotesEditing] = useState<boolean>(false);
  const [notesText, setNotesText] = useState<string>(memberProgress.notes || '');
  const [checklist, setChecklist] = useState<PMLearningChecklistItem[]>(
    Array.isArray(memberProgress.checklist) ? memberProgress.checklist : []
  );
  const [newCheckText, setNewCheckText] = useState<string>('');
  const [attachments, setAttachments] = useState<PMLearningAttachment[]>(
    Array.isArray(memberProgress.attachments) ? memberProgress.attachments : []
  );
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 章節單元折疊狀態 (預設收合為一項)
  const [isChaptersExpanded, setIsChaptersExpanded] = useState<boolean>(false);

  // 課程時數即時編輯狀態
  const [isEditingHours, setIsEditingHours] = useState<boolean>(false);
  const [tempHours, setTempHours] = useState<number>(course.hours || 0);

  useEffect(() => {
    setTempHours(course.hours || 0);
  }, [course.hours]);

  // 判斷當前使用者對此課程是否具備編輯權限 (主管理員 jamesyang, admin，或該課程建立者)
  const canEdit = canUserEditCourse(currentUser, course.createdBy);

  // 同步外部變更：只依賴純值/序列化字串，完全不放物件參考進依賴陣列
  // 這是 Error #185 的根源修復：rawProgress 是不穩定的物件參考，每次 course 變動都不同
  const currentProgressPercent = rawProgress?.progressPercent ?? 0;
  const currentNotes = rawProgress?.notes ?? '';
  const currentChecklistKey = JSON.stringify(rawProgress?.checklist || []);
  const currentAttachmentsKey = JSON.stringify(rawProgress?.attachments || []);

  useEffect(() => {
    setProgressVal(currentProgressPercent);
  }, [currentProgressPercent]);

  useEffect(() => {
    setNotesText(currentNotes);
  }, [currentNotes]);

  useEffect(() => {
    try {
      setChecklist(JSON.parse(currentChecklistKey));
    } catch {
      setChecklist([]);
    }
  }, [currentChecklistKey]);

  useEffect(() => {
    try {
      setAttachments(JSON.parse(currentAttachmentsKey));
    } catch {
      setAttachments([]);
    }
  }, [currentAttachmentsKey]);

  // 儲存快速時數修改
  const handleSaveHours = async () => {
    const clean = Math.max(0, Number(tempHours) || 0);
    setIsEditingHours(false);
    onUpdateCourse({ ...course, hours: clean });
    try {
      const res = await updateCourseHours(course.id, clean);
      if (res.success) {
        toast({ title: '已更新時數', description: `「${course.title}」已設定為 ${clean} 小時` });
      } else {
        toast({ title: '時數儲存失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '更新時數錯誤', description: err.message, variant: 'destructive' });
    }
  };

  // 更新個人進度至伺服器
  const saveProgressPatch = async (patch: Partial<PMLearningMemberProgress>) => {
    setIsSaving(true);
    try {
      const res = await updatePMMemberProgress(course.id, userId, patch);
      if (res.success && res.data) {
        const updatedCourse = {
          ...course,
          memberProgress: {
            ...(course.memberProgress || {}),
            [userId]: res.data,
          },
        };
        onUpdateCourse(updatedCourse);
      } else {
        toast({ title: '儲存失敗', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '更新錯誤', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // 1. 滑動進度條放開時儲存
  const handleSliderChangeCommit = (val: number[]) => {
    const newP = val[0];
    setProgressVal(newP);
    saveProgressPatch({
      progressPercent: newP,
      isCompleted: newP >= 100,
    });
  };

  // 一鍵標記已完成 (100%)
  const handleMarkComplete = () => {
    setProgressVal(100);
    const allChecked = checklist.map((c) => ({ ...c, completed: true }));
    setChecklist(allChecked);
    saveProgressPatch({
      progressPercent: 100,
      isCompleted: true,
      checklist: allChecked,
    });
    toast({ title: '恭喜！課程已完訓', description: `已將「${course.title}」標記為 100% 完成！` });
  };

  // 重置進度為 0%
  const handleResetProgress = () => {
    setProgressVal(0);
    saveProgressPatch({
      progressPercent: 0,
      isCompleted: false,
    });
  };

  // 依課程章節單元自動換算 %
  const handleAutoCalcFromChecklist = () => {
    if (checklist.length === 0) return;
    const completedCount = checklist.filter((c) => c.completed).length;
    const calcPercent = Math.round((completedCount / checklist.length) * 100);
    setProgressVal(calcPercent);
    saveProgressPatch({
      progressPercent: calcPercent,
      isCompleted: calcPercent >= 100,
    });
    toast({
      title: '已依章節單元換算進度',
      description: `章節單元已完成 ${completedCount}/${checklist.length} 項，達成率換算為 ${calcPercent}%`,
    });
  };

  // 2. 切換檢核項目
  const handleToggleCheck = (checkId: string) => {
    const updated = checklist.map((c) =>
      c.id === checkId ? { ...c, completed: !c.completed } : c
    );
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 新增檢核項
  const handleAddCheckItem = () => {
    if (!newCheckText.trim()) return;
    const newItem = {
      id: `chk-${Date.now()}`,
      title: newCheckText.trim(),
      completed: false,
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    setNewCheckText('');
    saveProgressPatch({ checklist: updated });
  };

  // 刪除檢核項
  const handleDeleteCheckItem = (checkId: string) => {
    const updated = checklist.filter((c) => c.id !== checkId);
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 3. 儲存筆記
  const handleSaveNotes = () => {
    saveProgressPatch({ notes: notesText });
    setIsNotesEditing(false);
    toast({ title: '筆記已儲存', description: '個人心得與筆記已成功更新至雲端！' });
  };

  // 4. 新增雲端/附件連結
  const handleAddAttachment = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      toast({ title: '請填寫連結名稱與網址', variant: 'destructive' });
      return;
    }
    const newAtt: PMLearningAttachment = {
      id: `att-${Date.now()}`,
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim(),
      type: newLinkUrl.includes('drive.google') ? 'drive' : 'link',
      createdAt: new Date().toISOString(),
    };
    const updated = [...attachments, newAtt];
    setAttachments(updated);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setIsAddingLink(false);
    saveProgressPatch({ attachments: updated });
    toast({ title: '已新增雲端成果連結', description: newAtt.title });
  };

  // 刪除附件連結
  const handleDeleteAttachment = (attId: string) => {
    const updated = attachments.filter((a) => a.id !== attId);
    setAttachments(updated);
    saveProgressPatch({ attachments: updated });
  };

  const isFinished = progressVal >= 100 || memberProgress.isCompleted;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300">
      {/* 卡片頂部條 (Header：包含上下排序、名稱、領域、狀態、進度%、日期、時數與展開按鈕) */}
      <div className="p-4 sm:p-5 bg-linear-to-r from-white via-slate-50/50 to-indigo-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* 左側：排序控制 + 課程標題 + 分類 + 狀態 + 進度% + 日期 + 時數 */}
          <div className="flex items-start gap-2.5 sm:gap-3.5 flex-1 min-w-0">
            {/* 上下移動箭頭 (個人自訂排序) */}
            <div className="flex flex-col gap-0.5 shrink-0 pt-0.5" title="個人自訂課程呈現順序">
              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveCourse('up');
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="向上移動"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveCourse('down');
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="向下移動"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              {/* 第一行：載體型態 + 標題 + 領域 + 出刊期別 + 時效性 + 狀態 + 進度% + 日期 + 時數 */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 載體型態 Badge */}
                {(() => {
                  const typeConfig = CONTENT_TYPE_CONFIG[course.type || 'course'] || CONTENT_TYPE_CONFIG['course'];
                  return (
                    <Badge className={`text-xs shrink-0 ${typeConfig.badgeClass}`}>
                      <span className="mr-1">{typeConfig.icon}</span>
                      {typeConfig.label}
                    </Badge>
                  );
                })()}

                <span className="font-bold text-slate-900 text-base sm:text-lg leading-snug">
                  {course.title}
                </span>

                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-medium shrink-0">
                  {course.category}
                </Badge>

                {/* 專欄子主題 / 單元標籤 (如：科技曼讀) */}
                {course.subSource && (
                  <Badge variant="outline" className="text-xs bg-indigo-50/80 text-indigo-900 border-indigo-300 font-semibold shrink-0">
                    📂 {course.subSource}
                  </Badge>
                )}

                {/* 文章發布日期 */}
                {course.issueDate && (
                  <Badge variant="outline" className="text-xs bg-indigo-50/70 text-indigo-700 border-indigo-200 font-mono shrink-0">
                    <Calendar className="w-3 h-3 mr-1 text-indigo-500" />
                    發布日期: {course.issueDate}
                  </Badge>
                )}

                {/* 文章時效性標籤 */}
                {course.type === 'article' && (
                  course.timelinessType === 'time_sensitive' ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] shrink-0">
                      ⚡ 時效趨勢
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[11px] shrink-0">
                      常青知識
                    </Badge>
                  )
                )}

                {/* AI 導讀完成標記 */}
                {course.aiAnalysis?.summary && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] shrink-0">
                    🤖 AI 導讀已完成
                  </Badge>
                )}

                {/* 狀態 Badge */}
                <Badge
                  className={`text-xs shrink-0 ${
                    isFinished
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : progressVal > 0
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isFinished ? '✅ 已研讀完畢' : progressVal > 0 ? `⚡ 研讀中` : '📌 待啟動'}
                </Badge>

                {/* 進度 % (明確放在課程名稱旁邊) */}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
                    isFinished
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : progressVal > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  進度: {progressVal}%
                </span>

                {/* 起訖日期 (明確放在課程名稱旁邊) */}
                {(course.startDate || course.endDate) && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {course.startDate || '未定'} ~ {course.endDate || '未定'}
                    </span>
                  </span>
                )}

                {/* 研習時數 */}
                <div className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  {isEditingHours ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="0"
                        value={tempHours}
                        onChange={(e) => setTempHours(Number(e.target.value))}
                        className="w-14 h-5 px-1 text-xs border rounded bg-white font-bold"
                        autoFocus
                      />
                      <span className="text-[11px]">小時</span>
                      <button
                        type="button"
                        onClick={handleSaveHours}
                        className="p-0.5 text-emerald-600 hover:bg-emerald-100 rounded"
                        title="確認儲存時數"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingHours(false)}
                        className="p-0.5 text-slate-400 hover:bg-slate-200 rounded"
                        title="取消"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{course.hours || 0} 小時</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempHours(course.hours || 0);
                          setIsEditingHours(true);
                        }}
                        className="p-0.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
                        title="點擊修改這門課程的培訓時數"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右側操作群：閱讀全文 + 傳送門 + 編輯 + 展開/收合切換按鈕 */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 self-start lg:self-center pl-7 lg:pl-0">
            {/* 知識文章「閱讀全文」按鈕 */}
            {(course.type === 'article' || course.content) && (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReader(course);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all active:scale-95"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>📄 閱讀全文</span>
                {course.aiAnalysis?.summary && <Sparkles className="h-3 w-3 text-amber-300 ml-0.5" />}
              </Button>
            )}

            {/* 外部傳送門按鈕 */}
            {course.externalUrl && (
              <a
                href={course.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all active:scale-95"
              >
                <span>
                  🚀 {course.type === 'video' ? '觀看影音' : course.type === 'article' ? '原文網址' : '外部傳送門'}
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {/* 課程編輯與刪除權限 (主管理員 jamesyang, admin，或建立者可編輯) */}
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCourse(course)}
                  className="h-8 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                  title="主管理員 / 建立者：可調整名稱、來源、傳送門與期程"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">編輯</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteCourse(course.id, course.title)}
                  className="h-8 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="刪除此項目"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* 展開 / 收合詳情按鈕 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCardExpanded((prev) => !prev)}
              className="h-8 px-3 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 gap-1 shadow-2xs"
            >
              {isCardExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                  <span>收合詳情 ▴</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                  <span>展開詳情 ▾</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 展開時才顯示詳細資訊與操作項目 (進度滑桿、章節檢核、心得筆記、成果連結) */}
      {isCardExpanded && (
        <div className="p-5 space-y-6 border-t border-slate-100 bg-white">
          {/* 講師與課程簡介 */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">
                  {course.type === 'article'
                    ? '專欄來源 / 出版媒體：'
                    : course.type === 'video'
                    ? '頻道 / 講者 / 平台：'
                    : course.type === 'book'
                    ? '作者 / 出版社：'
                    : '培訓平台 / 講師：'}
                </span>
                <span className="text-indigo-600 font-bold">
                  {course.source || course.instructorOrPlatform}
                  {course.subSource && ` · ${course.subSource}`}
                </span>
              </div>
              {course.issueDate && (
                <div className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  📅 發布日期: {course.issueDate}
                </div>
              )}
              {course.createdBy && (
                <div className="text-[11px] text-slate-400">
                  {course.createdBy === 'system' ? '（系統內建）' : '（成員建立）'}
                </div>
              )}
            </div>
            {course.description && (
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {course.description}
              </p>
            )}
          </div>

          {/* 文章專屬：來源與期別導讀卡 */}
          {course.type === 'article' && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-600 text-white text-xs">
                    📄 付費知識文章 (全文已收錄)
                  </Badge>
                  {course.issueDate && (
                    <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-mono text-xs">
                      📅 發布日期: {course.issueDate}
                    </Badge>
                  )}
                  {course.timelinessType === 'time_sensitive' ? (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs">
                      ⚡ 時效趨勢 (近期關鍵)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-xs">
                      🌱 常青知識
                    </Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={() => onOpenReader(course)}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>開啟沉浸式閱讀視窗</span>
                  {course.aiAnalysis?.summary && <Sparkles className="w-3 h-3 text-amber-300" />}
                </Button>
              </div>

              {course.aiAnalysis?.summary ? (
                <div className="bg-white rounded-lg p-3 border border-emerald-100 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-emerald-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI 導讀重點速覽：</span>
                  </div>
                  <p className="line-clamp-3 leading-relaxed text-slate-700">
                    {course.aiAnalysis.summary}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  {course.description || '本文已完整收錄於系統中，點選上方「開啟沉浸式閱讀視窗」可全文閱讀與執行 AI 導讀。'}
                </p>
              )}
            </div>
          )}

          {/* 影音專屬：重點時間標籤與筆記 */}
          {course.type === 'video' && course.videoTimestampNotes && (
            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-2">
              <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-rose-600" />
                <span>重點時間標籤與筆記：</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-rose-100 text-xs">
                <MarkdownPreview content={course.videoTimestampNotes} />
              </div>
            </div>
          )}

          {/* 個人閱讀專屬：核心金句與落地行動清單 */}
          {course.type === 'book' && course.bookQuotesAndReflections && (
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <div className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                <span>核心金句與落地行動清單 (Action Plan)：</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-100 text-xs">
                <MarkdownPreview content={course.bookQuotesAndReflections} />
              </div>
            </div>
          )}

          {/* 1. 進度條（手動拉 % 或一鍵勾選完成） */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">個人學習進度：</span>
                <span
                  className={`text-lg font-extrabold ${
                    isFinished ? 'text-emerald-600' : progressVal > 0 ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  {progressVal}%
                </span>
                {isSaving && <span className="text-[10px] text-indigo-500 animate-pulse">雲端儲存中...</span>}
              </div>

              {/* 進度快捷按鈕 */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoCalcFromChecklist}
                  className="h-7 text-[11px] text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                  title="根據課程章節單元勾選比率自動算出百分比"
                >
                  <Calculator className="h-3 w-3" />
                  <span>依章節單元換算</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetProgress}
                  className="h-7 text-[11px] text-slate-500 hover:bg-slate-100 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>重設0%</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleMarkComplete}
                  className={`h-7 text-[11px] font-bold gap-1 transition-all ${
                    isFinished
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>標記為已完成 (100%)</span>
                </Button>
              </div>
            </div>

            {/* 互動式 Slider 手動滑動拉 % */}
            <div className="pt-2 px-1">
              <Slider
                value={[progressVal]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) => setProgressVal(val[0])}
                onValueCommit={handleSliderChangeCommit}
                className="cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 px-1">
              <span>0% 待開始</span>
              <span>25% 研讀中</span>
              <span>50% 半數完成</span>
              <span>75% 演練驗收</span>
              <span>100% 完訓結案</span>
            </div>
          </div>

          {/* 2. 課程章節單元 (學習進度檢核，支援展開/收合為一項) */}
          <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs transition-all">
            {/* 標題列：可收合與展開，縮成一項 */}
            <div
              onClick={() => setIsChaptersExpanded((prev) => !prev)}
              className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/80 hover:bg-slate-100 cursor-pointer select-none transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  課程章節單元
                </span>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-semibold ${
                    checklist.filter((c) => c.completed).length === checklist.length && checklist.length > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {checklist.filter((c) => c.completed).length} / {checklist.length} 單元已達成
                </Badge>
                {checklist.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    (進度 {Math.round((checklist.filter((c) => c.completed).length / checklist.length) * 100)}%)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  {isChaptersExpanded ? '收合章節單元' : '展開章節單元'}
                </span>
                <div className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 shadow-2xs">
                  {isChaptersExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>
            </div>

            {/* 展開時才顯示完整的章節單元清單 (保留核取方格) */}
            {isChaptersExpanded && (
              <div className="p-3.5 space-y-2.5 bg-slate-50/40 border-t border-slate-200">
                <div className="flex items-center justify-between pb-1 text-xs text-slate-500">
                  <span>點選核取方格標記已修習完成之章節單元：</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoCalcFromChecklist();
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-white px-2 py-1 rounded border border-indigo-100 shadow-2xs hover:bg-indigo-50 transition-colors"
                    title="根據章節單元完成比例自動換算上方進度百分比"
                  >
                    <Calculator className="h-3 w-3" />
                    <span>依章節換算進度</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(Array.isArray(checklist) ? checklist : []).map((item, idx) => (
                    <div
                      key={item?.id || `chk-idx-${idx}`}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        item?.completed
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-500'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
                        <Checkbox
                          checked={Boolean(item?.completed)}
                          onCheckedChange={() => item?.id && handleToggleCheck(item.id)}
                        />
                        <span className="text-[11px] font-mono text-slate-400 font-medium">
                          {idx + 1}.
                        </span>
                        <span
                          className={
                            item?.completed
                              ? 'line-through text-slate-400'
                              : 'font-semibold text-slate-800'
                          }
                        >
                          {item?.title || '單元'}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => item?.id && handleDeleteCheckItem(item.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title="刪除此章節單元"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 新增個人章節單元輸入框 */}
                <div className="flex gap-2 pt-1.5">
                  <Input
                    value={newCheckText}
                    onChange={(e) => setNewCheckText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCheckItem();
                      }
                    }}
                    placeholder="新增章節單元，例如：「章節 1：基礎環境建置」、「實機測試與驗收」..."
                    className="h-8 text-xs bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCheckItem}
                    className="h-8 text-xs shrink-0 text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>新增單元</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 3. 個人心得與筆記 (支援 Markdown 與富文本工具) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">
                  個人心得與筆記 (支援 Markdown 語法)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isNotesEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsNotesEditing(false)}
                      className="h-7 text-xs text-slate-500"
                    >
                      取消編輯
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveNotes}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 font-semibold"
                    >
                      <Save className="h-3 w-3" />
                      <span>儲存心得</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNotesEditing(true)}
                    className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold"
                  >
                    <span>編輯筆記</span>
                  </Button>
                )}
              </div>
            </div>

            {isNotesEditing ? (
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                {/* Markdown 快捷工具列 */}
                <div className="flex flex-wrap items-center gap-1 pb-2 border-b border-slate-100 text-[11px] text-slate-600">
                  <span className="text-[10px] text-slate-400 mr-1">快捷工具:</span>
                  <button
                    type="button"
                    onClick={() => setNotesText((prev) => prev + '\n### 章節重點\n')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-mono"
                  >
                    H3標題
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesText((prev) => prev + '**重點字** ')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                  >
                    粗體
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesText((prev) => prev + '\n- 條列要點一\n- 條列要點二\n')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    條列
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesText((prev) => prev + '\n> 重要觀念摘錄\n')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 italic"
                  >
                    引言
                  </button>
                </div>

                <Textarea
                  rows={6}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="紀錄這堂課的學習重點、對燁輝專案或億威內部落地之思考、疑難問題點..."
                  className="text-xs font-mono leading-relaxed"
                />
                <div className="text-[11px] text-slate-400 text-right">
                  支援 Markdown 格式（# 標題、**粗體**、- 列表、&gt; 引言）
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <MarkdownPreview content={notesText} />
              </div>
            )}
          </div>

          {/* 4. 相關附件 / 雲端連結 (串聯個人整理的重點簡報或實作成果) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-800">
                  相關附件與成果雲端連結 ({attachments.length})
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingLink(!isAddingLink)}
                className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 font-semibold"
              >
                <Plus className="h-3 w-3" />
                <span>新增成果連結</span>
              </Button>
            </div>

            {/* 新增連結表單 */}
            {isAddingLink && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="text-xs font-bold text-blue-900">
                  新增雲端教材、重點簡報或成果連結：
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="檔案/連結標題，例如：專案四大階段甘特圖範本.pdf"
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://drive.google.com/... 或 GitHub 連結"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingLink(false)}
                    className="h-7 text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddAttachment}
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    確認新增
                  </Button>
                </div>
              </div>
            )}

            {/* 附件清單 */}
            {attachments.length === 0 && !isAddingLink && (
              <div className="text-xs text-slate-400 italic py-2 bg-slate-50/50 rounded-lg text-center border border-dashed border-slate-200">
                尚未綁定相關簡報或雲端實作成果連結，點擊上方按鈕即可加入。
              </div>
            )}

            {Array.isArray(attachments) && attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div
                    key={att?.id || att?.url}
                    className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors"
                  >
                    <a
                      href={att?.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 flex-1 min-w-0 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      <LinkIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="truncate">{att?.title || att?.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 ml-2 transition-colors"
                      title="移除此連結"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
