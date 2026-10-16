'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PMLearningCourse,
  PMLearningMemberProgress,
  PMLearningChecklistItem,
  PMLearningAttachment,
  PMLearningReflectionItem,
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
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Layers,
  Link as LinkIcon,
  ShieldCheck,
  Tag,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  X,
  Search,
  Filter,
  Bot,
  Zap,
  Bookmark,
  Video,
  HelpCircle,
  UploadCloud,
  Loader2,
  Download,
  MessageSquare,
  MessageSquareQuote,
  Pin,
} from 'lucide-react';
import {
  updatePMMemberProgress,
  deletePMLearningCourse,
  saveUserCourseOrder,
  updateCourseHours,
} from '@/lib/pm-learning-actions';
import {
  isCourseManager,
  canUserEditCourse,
  expandChecklistToItems,
  checklistItemsToChapters,
  isPlaceholderSubUnitTitle,
} from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';
import { uploadPMLearningFile, formatLearningFileName } from '@/lib/pm-learning-upload';
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

  // 依該成員個人自訂順序 (sortOrder) 排序課程 (置頂項目優先於最頂端)
  const sortedMyCourses = useMemo(() => {
    const uid = activeMember?.uid || '';
    return [...myCourses].sort((a, b) => {
      const progA = (a.memberProgress || {})[uid];
      const progB = (b.memberProgress || {})[uid];
      const pinA = progA?.isPinned !== undefined ? Boolean(progA.isPinned) : Boolean(a.isPinned);
      const pinB = progB?.isPinned !== undefined ? Boolean(progB.isPinned) : Boolean(b.isPinned);
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;

      const orderA = progA?.sortOrder;
      const orderB = progB?.sortOrder;
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

  // 側欄展開/收合控制 (平常縮成一直行，需要時展開，極致節省空間並記憶習慣)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [showDetailedKpi, setShowDetailedKpi] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pm_learning_sidebar_collapsed');
      if (saved !== null) {
        setIsSidebarCollapsed(saved === 'true');
      }
    } catch (e) {
      // 容錯保護
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pm_learning_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // 載體型態切換分頁 (全部 | 課程 | 文章 | 影音 | 閱讀)
  const [selectedContentType, setSelectedContentType] = useState<'all' | PMLearningContentType>('all');
  const [selectedIssueDate, setSelectedIssueDate] = useState<string>('全部');
  const [selectedTimeliness, setSelectedTimeliness] = useState<string>('全部');

  // 文章閱讀視窗狀態
  const [readerCourse, setReaderCourse] = useState<PMLearningCourse | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [readerInitialOpenChat, setReaderInitialOpenChat] = useState(false);
  const [readerInitialChapterIndex, setReaderInitialChapterIndex] = useState<number | undefined>(undefined);

  const handleOpenReader = (c: PMLearningCourse, openChat: boolean = false, chapterIndex?: number) => {
    setReaderCourse(c);
    setReaderInitialOpenChat(openChat);
    setReaderInitialChapterIndex(chapterIndex);
    setIsReaderOpen(true);
  };

  // 篩選與搜尋狀態 (關鍵字查詢、課程領域、主來源/平台/出版社、子主題/系列標籤、學習狀態、排序標準)
  // 正常預設：完成度最高放最下面 (進度: 低 → 高，0% ~ 100%，置頂項目優先排於最頂端)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('全部');
  const [selectedSubSource, setSelectedSubSource] = useState<string>('全部');
  const [selectedStatus, setSelectedStatus] = useState<string>('全部');
  const [sortCriterion, setSortCriterion] = useState<
    'progress-asc' | 'custom' | 'progress-desc' | 'date-desc' | 'date-asc'
  >('progress-asc');

  // 各載體數量統計
  const contentTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: myCourses.length, course: 0, article: 0, video: 0, book: 0 };
    myCourses.forEach((c) => {
      const t = c.type || 'course';
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [myCourses]);

  // 依據目前所選「載體類型」先過濾出該載體的專屬項目集合，確保知識文章、個人閱讀、線上課程、影音資源的篩選條件彼此獨立不混雜
  const typeScopedCourses = useMemo(() => {
    if (selectedContentType === 'all') return myCourses;
    return myCourses.filter((c) => (c.type || 'course') === selectedContentType);
  }, [myCourses, selectedContentType]);

  // 切換載體類型時，自動重設不適用於新載體的進階篩選條件，避免不同載體條件互相干擾
  const handleSelectContentType = (nextType: 'all' | PMLearningContentType) => {
    setSelectedContentType(nextType);
    setSelectedPlatform('全部');
    setSelectedSubSource('全部');
    setSelectedIssueDate('全部');
    setSelectedTimeliness('全部');
    if (nextType !== 'all' && selectedCategory !== '全部') {
      const hasCatInNext = myCourses.some(
        (c) => (c.type || 'course') === nextType && c.category?.trim() === selectedCategory
      );
      if (!hasCatInNext) {
        setSelectedCategory('全部');
      }
    }
  };

  // 所有可用出刊/發布年月選項 (依目前載體類型動態過濾)
  const allIssueDates = useMemo(() => {
    const set = new Set<string>();
    typeScopedCourses.forEach((c) => {
      if (c.issueDate?.trim()) {
        const ym = c.issueDate.trim().substring(0, 7);
        set.add(ym);
      }
    });
    return ['全部', ...Array.from(set).sort().reverse()];
  }, [typeScopedCourses]);

  // 所有可用領域選項 (選擇特定載體如「知識文章」或「個人閱讀」時，僅顯示該載體實際擁有的領域，不混入其他載體領域)
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    if (selectedContentType === 'all') {
      (categories || []).forEach((cat) => {
        if (cat?.trim()) set.add(cat.trim());
      });
    }
    typeScopedCourses.forEach((c) => {
      if (c.category?.trim()) set.add(c.category.trim());
    });
    return ['全部', ...Array.from(set)];
  }, [typeScopedCourses, categories, selectedContentType]);

  // 主來源選項：專欄媒體 (文章) / 作者出版社 (個人閱讀) / 培訓平台講師 (線上課程) / 頻道講者 (影音) — 僅取主來源，絕不混入 subSource
  const allPlatforms = useMemo(() => {
    const set = new Set<string>();
    typeScopedCourses.forEach((c) => {
      const src = (c.source || c.instructorOrPlatform || '').trim();
      if (src) {
        set.add(src);
      }
    });
    return ['全部', ...Array.from(set)];
  }, [typeScopedCourses]);

  // 子主題 / 系列標籤選項：專欄子主題 (文章，如科技曼讀、商業解碼) / 書籍系列標籤 (個人閱讀，如商業投資) — 獨立分開過濾
  const allSubSources = useMemo(() => {
    const set = new Set<string>();
    typeScopedCourses.forEach((c) => {
      if (selectedPlatform !== '全部') {
        const src = (c.source || c.instructorOrPlatform || '').trim();
        if (src.toLowerCase() !== selectedPlatform.toLowerCase()) return;
      }
      const sub = (c.subSource || '').trim();
      if (sub) {
        set.add(sub);
      }
    });
    return ['全部', ...Array.from(set)];
  }, [typeScopedCourses, selectedPlatform]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedContentType !== 'all' ||
    selectedCategory !== '全部' ||
    selectedIssueDate !== '全部' ||
    selectedTimeliness !== '全部' ||
    selectedPlatform !== '全部' ||
    selectedSubSource !== '全部' ||
    selectedStatus !== '全部';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedContentType('all');
    setSelectedCategory('全部');
    setSelectedIssueDate('全部');
    setSelectedTimeliness('全部');
    setSelectedPlatform('全部');
    setSelectedSubSource('全部');
    setSelectedStatus('全部');
    setSortCriterion('progress-asc');
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

      // 3. 出刊/發布年月篩選
      if (selectedIssueDate !== '全部') {
        const ym = (course.issueDate || '').trim().substring(0, 7);
        if (ym !== selectedIssueDate) return false;
      }

      // 4. 時效性篩選 (知識文章專屬)
      if (selectedTimeliness !== '全部') {
        if (selectedTimeliness === 'time_sensitive' && course.timelinessType !== 'time_sensitive') {
          return false;
        }
        if (selectedTimeliness === 'evergreen' && course.timelinessType !== 'evergreen') {
          return false;
        }
      }

      // 5A. 主來源篩選 (專欄媒體 / 作者出版社 / 培訓平台 / 頻道講者)
      if (selectedPlatform !== '全部') {
        const p = selectedPlatform.toLowerCase();
        const primarySrc = (course.source || course.instructorOrPlatform || '').trim().toLowerCase();
        const fallbackPlatform = (course.instructorOrPlatform || '').trim().toLowerCase();
        if (primarySrc !== p && fallbackPlatform !== p) {
          return false;
        }
      }

      // 5B. 子主題 / 系列標籤篩選 (專欄子主題 / 書籍系列 / 課程模組)
      if (selectedSubSource !== '全部') {
        const s = selectedSubSource.toLowerCase();
        if ((course.subSource || '').trim().toLowerCase() !== s) {
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
    selectedSubSource,
    selectedStatus,
    activeMember?.uid,
  ]);

  // 依排序條件 (置頂優先 + 正常預設完成度最高放最下面 / 自訂 / 發布日期) 對清單進行排序
  const displayCourses = useMemo(() => {
    const uid = activeMember?.uid || '';
    const list = [...filteredCourses];

    const isPinned = (c: PMLearningCourse) => {
      const prog = (c.memberProgress || {})[uid];
      if (prog?.isPinned !== undefined) return Boolean(prog.isPinned);
      return Boolean(c.isPinned);
    };

    const getPercent = (c: PMLearningCourse) => {
      const prog = (c.memberProgress || {})[uid];
      return prog?.isCompleted ? 100 : (prog?.progressPercent ?? 0);
    };

    const getDate = (c: PMLearningCourse) => {
      return c.issueDate || c.startDate || c.createdAt || '';
    };

    return list.sort((a, b) => {
      // 1. 置頂優先 (Pin to top)：置頂項目永遠優先排於最頂端
      const pinA = isPinned(a);
      const pinB = isPinned(b);
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;

      // 2. 自訂排序 (可依個人自訂順序上下移動)
      if (sortCriterion === 'custom') {
        const orderA = (a.memberProgress || {})[uid]?.sortOrder;
        const orderB = (b.memberProgress || {})[uid]?.sortOrder;
        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return 0;
      }

      // 3. 正常預設：完成度最高放最下面 (進度低 → 高，0% ~ 100%)
      if (sortCriterion === 'progress-asc') {
        const valA = getPercent(a);
        const valB = getPercent(b);
        if (valA !== valB) return valA - valB;
        const dateA = getDate(a);
        const dateB = getDate(b);
        return dateB.localeCompare(dateA);
      }

      // 4. 進度高 → 低 (100% ~ 0%)
      if (sortCriterion === 'progress-desc') {
        const valA = getPercent(a);
        const valB = getPercent(b);
        if (valB !== valA) return valB - valA;
        const dateA = getDate(a);
        const dateB = getDate(b);
        return dateB.localeCompare(dateA);
      }

      // 5. 發布日期：新 → 舊
      if (sortCriterion === 'date-desc') {
        const dateA = getDate(a);
        const dateB = getDate(b);
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        const valA = getPercent(a);
        const valB = getPercent(b);
        return valA - valB;
      }

      // 6. 發布日期：舊 → 新
      if (sortCriterion === 'date-asc') {
        const dateA = getDate(a);
        const dateB = getDate(b);
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const valA = getPercent(a);
        const valB = getPercent(b);
        return valA - valB;
      }

      return 0;
    });
  }, [filteredCourses, sortCriterion, activeMember?.uid]);

  // 統計當前清單中的置頂項目筆數
  const pinnedCount = useMemo(() => {
    const uid = activeMember?.uid || '';
    return displayCourses.filter((c) => {
      const prog = (c.memberProgress || {})[uid];
      return prog?.isPinned !== undefined ? Boolean(prog.isPinned) : Boolean(c.isPinned);
    }).length;
  }, [displayCourses, activeMember?.uid]);

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
    <div className="w-full">
      {/* 左右分欄佈局：左側可收合導航/篩選側欄 + 右側主內容區 */}
      <div className="flex flex-col lg:flex-row gap-3.5 items-start w-full">
        {/* ============================================================== */}
        {/* 左側可收合側欄 (Collapsible Sidebar)                             */}
        {/* - 收合狀態：寬度 56px (一直行)，顯示精簡圖示，完全不佔垂直高度      */}
        {/* - 展開狀態：寬度 270px，顯示完整分類、領域標籤、成員切換與篩選     */}
        {/* ============================================================== */}
        <aside
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all duration-300 shrink-0 ${
            isSidebarCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-64 xl:w-72'
          } sticky top-3 self-start max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden z-10`}
        >
          {/* A. 當側欄收合 (isSidebarCollapsed === true) */}
          {isSidebarCollapsed ? (
            <>
              {/* 移動裝置 (< lg) 縮起時顯示之極簡橫列導航按鈕 */}
              <div className="flex lg:hidden items-center justify-between p-2.5 bg-white w-full">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-100 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                  <span>展開導覽與篩選選單</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-200/80 text-indigo-900 font-mono">
                    {contentTypeCounts[selectedContentType] || contentTypeCounts.all}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {activeMember?.displayName || 'PM'}
                  </span>
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                    >
                      清除篩選
                    </button>
                  )}
                </div>
              </div>

              {/* 電腦版 (lg+) 縮成一直行迷你直立 Dock (寬度 56px) */}
              <div className="hidden lg:flex flex-col items-center w-full py-2.5 space-y-2">
                {/* 頂部展開按鈕 */}
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 transition-all shadow-2xs group relative"
                  title="展開左側導航與篩選選單 (點擊展開)"
                >
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600 transition-transform group-hover:scale-110" />
                  <span className="sr-only">展開側欄</span>
                </button>

                {/* 載體直立圖示快捷鍵清單 */}
                <div className="flex flex-col items-center gap-1.5 pt-1 w-full px-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectContentType('all')}
                    className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative ${
                      selectedContentType === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs font-bold ring-2 ring-indigo-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={`全部項目 (${contentTypeCounts.all})`}
                  >
                    <span className="text-sm">🌐</span>
                    <span className="text-[9px] font-bold leading-none mt-0.5">{contentTypeCounts.all}</span>
                  </button>

                  {(['course', 'article', 'video', 'book'] as PMLearningContentType[]).map((type) => {
                    const cfg = CONTENT_TYPE_CONFIG[type];
                    const count = contentTypeCounts[type] || 0;
                    const isSelected = selectedContentType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSelectContentType(type)}
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs font-bold ring-2 ring-indigo-300'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        title={`${cfg.label} (${count})`}
                      >
                        <span className="text-sm leading-none">{cfg.icon}</span>
                        <span className="text-[9px] font-bold leading-none mt-0.5">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="w-8 border-t border-slate-200/80 my-1" />

                {/* 領域圖示按鈕 */}
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative ${
                    selectedCategory !== '全部'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title={`領域: ${selectedCategory} (點擊展開側欄切換)`}
                >
                  <Tag className="h-4 w-4" />
                  {selectedCategory !== '全部' && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
                  )}
                </button>

                {/* 篩選重設快速圖示 */}
                {isFiltered && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="w-10 h-8 rounded-xl flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all text-xs"
                    title="已套用篩選條件，點擊一鍵清除全部"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* 底部成員頭像 (點擊可展開人員切換) */}
                <div className="mt-auto pt-3 pb-1 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="w-9 h-9 rounded-full bg-linear-to-tr from-indigo-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-2xs hover:ring-2 hover:ring-indigo-400 transition-all"
                    title={`${activeMember?.displayName || activeMember?.email} (點擊展開人員切換)`}
                  >
                    {(activeMember?.displayName || activeMember?.email || 'PM').slice(0, 1).toUpperCase()}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* B. 當側欄展開 (isSidebarCollapsed === false) */
            <>
              {/* 側欄頂部列：標題與縮起按鈕 */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-800">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                  <span>導覽與篩選</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 gap-1 font-semibold"
                  title="縮合成一直行以獲取最大內文閱讀空間"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>縮成直行</span>
                </Button>
              </div>

              {/* 側欄主要滾動內容 */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs divide-y divide-slate-100/80">
                {/* 1. 成員與工作區身分 */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                      {(activeMember?.displayName || activeMember?.email || 'PM').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {activeMember?.displayName || activeMember?.email}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        億威電子 · {activeMember?.department || 'PMO專案管理處'}
                      </div>
                    </div>
                    {isAdminOrJames && (
                      <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0 font-semibold shrink-0">
                        管理員
                      </Badge>
                    )}
                  </div>

                  {/* 切換成員下拉選單 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      切換 PM 成員
                    </label>
                    <select
                      value={activeMember?.uid}
                      onChange={(e) => onActiveUserIdChange(e.target.value)}
                      className="w-full h-7.5 px-2 rounded-lg border border-slate-200 bg-slate-50/80 text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {(pmoMembers || []).map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName || m.email} ({m.department || 'PM'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. 載體類型分類 */}
                <div className="pt-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    載體類型
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleSelectContentType('all')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedContentType === 'all'
                          ? 'bg-indigo-50 text-indigo-900 font-extrabold border border-indigo-200/80 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🌐</span>
                        <span>全部項目</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
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
                          onClick={() => handleSelectContentType(type)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-900 font-extrabold border border-indigo-200/80 shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 修習狀態篩選 */}
                <div className="pt-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    修習狀態
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { key: '全部', label: '全部狀態' },
                      { key: '進行中', label: '⚡ 進行中' },
                      { key: '已完訓', label: '✅ 已完訓' },
                      { key: '待開始', label: '📌 待開始' },
                    ].map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setSelectedStatus(st.key)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all text-center ${
                          selectedStatus === st.key
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. 領域主題分類 (依目前所選載體類型動態過濾顯示) */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {selectedContentType === 'article'
                        ? '文章領域主題'
                        : selectedContentType === 'book'
                        ? '閱讀領域主題'
                        : selectedContentType === 'course'
                        ? '課程領域主題'
                        : selectedContentType === 'video'
                        ? '影音領域主題'
                        : '領域主題'}
                    </span>
                    {onOpenCategoryManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoryManager}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
                        title="維護領域清單"
                      >
                        <Tag className="h-3 w-3" />
                        <span>維護領域</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1">
                    {allCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. 依載體類型專屬分開之進階篩選條件 (知識文章 vs 個人閱讀 vs 線上課程 vs 影音資源) */}
                <div className="pt-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {selectedContentType === 'article'
                      ? '📄 知識文章篩選條件'
                      : selectedContentType === 'book'
                      ? '📖 個人閱讀篩選條件'
                      : selectedContentType === 'course'
                      ? '🎓 線上課程篩選條件'
                      : selectedContentType === 'video'
                      ? '🎥 影音資源篩選條件'
                      : '進階篩選條件'}
                  </div>

                  {/* A. 主來源篩選：依載體區分為「專欄媒體 (文章)」、「作者/出版社 (閱讀)」、「培訓平台/講師 (課程)」、「頻道/講者 (影音)」 */}
                  {allPlatforms.length > 1 && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-500">
                        {selectedContentType === 'article'
                          ? '專欄來源 / 出版媒體'
                          : selectedContentType === 'book'
                          ? '作者 / 出版社'
                          : selectedContentType === 'course'
                          ? '講師 / 培訓平台'
                          : selectedContentType === 'video'
                          ? '頻道 / 講者'
                          : '主來源 / 平台 / 出版社'}
                      </label>
                      <select
                        value={selectedPlatform}
                        onChange={(e) => {
                          setSelectedPlatform(e.target.value);
                          setSelectedSubSource('全部');
                        }}
                        className="w-full h-7.5 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="全部">
                          {selectedContentType === 'article'
                            ? '全部專欄 / 媒體來源'
                            : selectedContentType === 'book'
                            ? '全部作者 / 出版社'
                            : selectedContentType === 'course'
                            ? '全部講師 / 培訓平台'
                            : selectedContentType === 'video'
                            ? '全部頻道 / 講者'
                            : '全部來源 / 平台 / 出版社'}
                        </option>
                        {allPlatforms
                          .filter((p) => p !== '全部')
                          .map((p) => (
                            <option key={p} value={p}>
                              {selectedContentType === 'article'
                                ? `📰 專欄: ${p}`
                                : selectedContentType === 'book'
                                ? `📚 出版社/作者: ${p}`
                                : selectedContentType === 'course'
                                ? `🎓 平台/講師: ${p}`
                                : `來源: ${p}`}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* B. 子主題 / 系列標籤篩選：依載體區分為「專欄子主題 (文章，如科技曼讀、商業解碼)」與「書籍系列/專題標籤 (閱讀，如商業投資)」 */}
                  {allSubSources.length > 1 && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-500">
                        {selectedContentType === 'article'
                          ? '專欄子主題 / 單元標籤'
                          : selectedContentType === 'book'
                          ? '書籍系列 / 專題標籤'
                          : selectedContentType === 'course'
                          ? '模組系列 / 課程標籤'
                          : '子主題 / 系列標籤'}
                      </label>
                      <select
                        value={selectedSubSource}
                        onChange={(e) => setSelectedSubSource(e.target.value)}
                        className="w-full h-7.5 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="全部">
                          {selectedContentType === 'article'
                            ? '全部專欄子主題'
                            : selectedContentType === 'book'
                            ? '全部書籍系列 / 專題'
                            : selectedContentType === 'course'
                            ? '全部課程系列標籤'
                            : '全部子主題 / 系列標籤'}
                        </option>
                        {allSubSources
                          .filter((s) => s !== '全部')
                          .map((s) => (
                            <option key={s} value={s}>
                              📂 {s}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* C. 出刊 / 發布月份：依目前載體實際存在的月份動態顯示 */}
                  {(selectedContentType === 'article' ||
                    selectedContentType === 'book' ||
                    selectedContentType === 'all') &&
                    allIssueDates.length > 1 && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-slate-500">
                          {selectedContentType === 'article'
                            ? '文章出刊月份'
                            : selectedContentType === 'book'
                            ? '發布 / 出版月份'
                            : '發布 / 出刊月份'}
                        </label>
                        <select
                          value={selectedIssueDate}
                          onChange={(e) => setSelectedIssueDate(e.target.value)}
                          className="w-full h-7.5 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="全部">
                            {selectedContentType === 'article'
                              ? '全部出刊月份'
                              : '全部發布月份'}
                          </option>
                          {allIssueDates
                            .filter((d) => d !== '全部')
                            .map((d) => (
                              <option key={d} value={d}>
                                📅 {selectedContentType === 'article' ? `出刊: ${d}` : d}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                  {/* D. 時效性質：僅「知識文章」專屬顯示，個人閱讀與線上課程不顯示此項 */}
                  {selectedContentType === 'article' && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-500">
                        文章時效性質
                      </label>
                      <select
                        value={selectedTimeliness}
                        onChange={(e) => setSelectedTimeliness(e.target.value)}
                        className="w-full h-7.5 px-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="全部">全部時效性</option>
                        <option value="time_sensitive">⚡ 時效趨勢</option>
                        <option value="evergreen">🌱 常青知識</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 6. 清除所有篩選按鈕 */}
                {isFiltered && (
                  <div className="pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="w-full h-7.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 font-semibold"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>重設所有篩選條件</span>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* ============================================================== */}
        {/* 右側主內容區 (Main Content Area)                                */}
        {/* - 頂部超緊湊單行操作列 (搜尋 + 單行精簡 KPI 摘要 + 排序 + 新增)  */}
        {/* - 內文課程與文章清單直接頂到最上方，省下近 400px 垂直高度！     */}
        {/* ============================================================== */}
        <main className="flex-1 min-w-0 space-y-2.5 w-full">
          {/* 1. 頂部緊湊操作列 */}
          <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            {/* 左側：展開側欄按鈕 (縮起時醒目顯示) + 搜尋框 */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              {isSidebarCollapsed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 gap-1 font-semibold shrink-0 shadow-2xs"
                  title="展開左側導航與篩選選單"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">側欄選單</span>
                </Button>
              )}

              {/* 關鍵字搜尋框 */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋標題、專欄、內文、期別或筆記..."
                  className="pl-8 pr-7 h-8 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="清除關鍵字"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 中間：極簡單行 KPI 摘要膠囊 (僅佔單行高度！) */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs font-medium text-slate-700 shrink-0 shadow-2xs">
              <span className="font-bold text-slate-900">
                總計 {personalStats.total} 堂{' '}
                <span className="text-[10px] text-slate-400 font-normal">({personalStats.totalHours}h)</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-bold">進行中 {personalStats.inProgress}</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-700 font-bold">完訓 {personalStats.completed}</span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-700 font-bold">達成率 {personalStats.avgPercent}%</span>
              <button
                type="button"
                onClick={() => setShowDetailedKpi((p) => !p)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 ml-1 font-semibold underline decoration-dotted"
                title="點擊展開/收合詳細數據與時數分析卡片"
              >
                {showDetailedKpi ? '收起 ▴' : '詳情 ▾'}
              </button>
            </div>

            {/* 右側：排序方式 + 全部展開/收合 + 新增學習項目 */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* 排序選單 */}
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                <ArrowUpDown className="h-3 w-3 text-indigo-600" />
                <select
                  value={sortCriterion}
                  onChange={(e) =>
                    setSortCriterion(
                      e.target.value as 'custom' | 'progress-desc' | 'progress-asc' | 'date-desc' | 'date-asc'
                    )
                  }
                  className="h-7 px-1.5 rounded border-0 bg-transparent text-xs font-semibold text-indigo-900 focus:outline-none cursor-pointer"
                  title="選擇排序方式"
                >
                  <option value="progress-asc">📉 進度低→高 (完成放最下)</option>
                  <option value="custom">↕ 自訂排序 (可上下移動)</option>
                  <option value="progress-desc">📈 進度高→低</option>
                  <option value="date-desc">📅 日期新→舊</option>
                  <option value="date-asc">📅 日期舊→新</option>
                </select>
              </div>

              {/* 全部展開/收合 */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpandAllState((prev) => !prev)}
                className="h-8 px-2 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold shadow-2xs"
                title={expandAllState ? '全部收合' : '全部展開'}
              >
                {expandAllState ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">收合 ▴</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">展開 ▾</span>
                  </>
                )}
              </Button>

              {/* 新增學習項目按鈕 */}
              <Button
                type="button"
                onClick={() =>
                  onOpenCreateDialog(
                    activeMember?.uid,
                    selectedContentType !== 'all' ? selectedContentType : 'course'
                  )
                }
                className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1 shadow-2xs"
                title="新增學習項目"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>新增</span>
              </Button>
            </div>
          </div>

          {/* 2. 詳細 KPI 統計卡片 (預設收起，點擊「詳情 ▾」才展開) */}
          {showDetailedKpi && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 shadow-2xs transition-all">
              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-semibold text-slate-500">已指派項目</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {personalStats.total} 堂{' '}
                  <span className="text-xs font-normal text-slate-400">({personalStats.totalHours} 小時)</span>
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-semibold text-amber-600">積極進行中</span>
                <div className="text-base font-bold text-amber-600 mt-0.5">{personalStats.inProgress} 堂</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-semibold text-blue-600">已完訓結業</span>
                <div className="text-base font-bold text-blue-600 mt-0.5">
                  {personalStats.completed} 堂{' '}
                  <span className="text-xs font-normal text-blue-600/80">({personalStats.completedHours}h)</span>
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-600">個人完訓率</span>
                  <span className="text-xs font-bold text-indigo-700">
                    {personalStats.avgPercent}%{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      (時數 {personalStats.hoursPercent}%)
                    </span>
                  </span>
                </div>
                <Progress value={personalStats.avgPercent} className="h-1.5 mt-1 bg-indigo-100" />
              </div>
            </div>
          )}

          {/* 無課程提示 (全新成員尚未有任何項目) */}
          {sortedMyCourses.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 space-y-3">
              <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-700">
                目前尚未指派課程給 {activeMember?.displayName || activeMember?.email}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                您可以點擊上方「+ 新增」建立專屬進修項目，或切換至「主管 / 團隊視角 (Team View)」進行指派。
              </p>
              <Button
                type="button"
                onClick={() => onOpenCreateDialog(activeMember?.uid)}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                建立第一門自選學習項目
              </Button>
            </div>
          )}

      {/* 項目列表計數與提示 */}
      {sortedMyCourses.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
            <span>
              已排定 PM 成長地圖項目 (
              {isFiltered ? (
                <span className="text-indigo-600 font-extrabold">
                  符合條件 {displayCourses.length} / 全體 {sortedMyCourses.length} 筆
                </span>
              ) : (
                `${displayCourses.length} 筆`
              )}
              )
            </span>
            {pinnedCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] font-bold gap-1 shrink-0">
                <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
                <span>{pinnedCount} 筆置頂</span>
              </Badge>
            )}
            <span className="text-slate-400 font-normal hidden sm:inline">
              · 可依領域標籤快速切換主題，文章支援點擊「閱讀全文」查看內文與 AI 分析
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-semibold">
              排序: {
                sortCriterion === 'progress-desc' ? '📈 進度 (高 → 低)' :
                sortCriterion === 'progress-asc' ? '📉 預設 (進度低 → 高，完成放最下)' :
                sortCriterion === 'date-desc' ? '📅 發布日期 (新 → 舊)' :
                sortCriterion === 'date-asc' ? '📅 發布日期 (舊 → 新)' :
                '↕ 自訂排序'
              }
            </Badge>
            {isFiltered && (
              <div className="text-xs text-slate-400">
                已套用篩選條件
              </div>
            )}
          </div>
        </div>
      )}

      {/* 查無篩選結果提示 */}
      {sortedMyCourses.length > 0 && displayCourses.length === 0 && (
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
      <div className="space-y-2.5">
        {displayCourses.map((course) => {
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
                canManualSort={sortCriterion === 'custom'}
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
        </main>
      </div>

      {/* 知識文章沉浸式閱讀視窗 (支援 AI 摘要與筆記) */}
      <ArticleReaderDialog
        isOpen={isReaderOpen}
        onClose={() => {
          setIsReaderOpen(false);
          setReaderCourse(null);
          setReaderInitialOpenChat(false);
          setReaderInitialChapterIndex(undefined);
        }}
        course={readerCourse}
        initialOpenChat={readerInitialOpenChat}
        initialChapterIndex={readerInitialChapterIndex}
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
  canManualSort = true,
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
  canManualSort?: boolean;
  defaultExpanded?: boolean;
  onMoveCourse: (direction: 'up' | 'down') => void;
  onUpdateCourse: (course: PMLearningCourse) => void;
  onEditCourse: (course: PMLearningCourse) => void;
  onDeleteCourse: (courseId: string, title: string) => void;
  onOpenReader: (course: PMLearningCourse, openChat?: boolean, chapterIndex?: number) => void;
}) {
  const { toast } = useToast();
  const rawProgress = (course.memberProgress || {})[userId];
  const memberProgress: PMLearningMemberProgress = useMemo(() => {
    const defaultExpanded = expandChecklistToItems(
      Array.isArray(course.defaultChecklist) ? course.defaultChecklist : []
    );
    if (!rawProgress) {
      return {
        userId,
        userName: '成員',
        progressPercent: 0,
        isCompleted: false,
        notes: '',
        reflections: [],
        checklist: defaultExpanded,
        attachments: [],
      };
    }

    // 防呆自動同步：若 course.defaultChecklist 已包含兩階大單元/子單元，但成員進度目前仍為舊版扁平大單元 (無 chapterTitle 且缺少子單元)
    const rawChecklist = Array.isArray(rawProgress.checklist) ? rawProgress.checklist : [];
    const hasChapterInDefault =
      Array.isArray(course.defaultChecklist) &&
      course.defaultChecklist.some(
        (item: any) =>
          item &&
          typeof item === 'object' &&
          Array.isArray(item.subUnits) &&
          item.subUnits.length > 0
      );
    const hasChapterInMember = rawChecklist.some((item) => Boolean(item?.chapterTitle));

    let finalChecklist = rawChecklist;
    if (hasChapterInDefault && !hasChapterInMember && defaultExpanded.length > 0) {
      const completedTitles = new Set(
        rawChecklist
          .filter((c) => c.completed)
          .map((c) => (c.title || '').trim())
      );
      finalChecklist = defaultExpanded.map((item) => ({
        ...item,
        completed: completedTitles.has(item.title.trim()),
      }));
    }

    // 清理舊版預設產生的單一 X.1 (如 1.1, 2.1, 3.1, 6.1) 佔位子單元，讓未設定子標題的大單元直接以大單元本身顯示
    const chapCounts = new Map<string, number>();
    for (const item of finalChecklist) {
      const chap = (item?.chapterTitle || item?.title || '').trim();
      if (chap) chapCounts.set(chap, (chapCounts.get(chap) || 0) + 1);
    }
    finalChecklist = finalChecklist.map((item) => {
      const chap = (item?.chapterTitle || item?.title || '').trim();
      const sub = (item?.title || '').trim();
      if (chap && isPlaceholderSubUnitTitle(sub, chap, chapCounts.get(chap) || 1)) {
        return { ...item, chapterTitle: chap, title: chap };
      }
      return item;
    });

    // 確保個人歷程札記清單存在，若有舊 notes 則平滑遷移
    let finalReflections: PMLearningReflectionItem[] = Array.isArray(rawProgress.reflections)
      ? rawProgress.reflections
      : [];
    if (
      finalReflections.length === 0 &&
      typeof rawProgress.notes === 'string' &&
      rawProgress.notes.trim()
    ) {
      finalReflections = [
        {
          id: `legacy-${userId}`,
          createdAt: rawProgress.updatedAt
            ? String(rawProgress.updatedAt).replace('T', ' ').slice(0, 16)
            : new Date().toISOString().replace('T', ' ').slice(0, 16),
          content: rawProgress.notes.trim(),
          relatedUnit: '課程初期心得',
        },
      ];
    }

    return {
      ...rawProgress,
      checklist: finalChecklist,
      reflections: finalReflections,
    };
  }, [rawProgress, userId, course.defaultChecklist]);

  // 控制整張卡片下半部是否展開（使用者要求紅框下預設收起）
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(defaultExpanded);

  useEffect(() => {
    setIsCardExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const [progressVal, setProgressVal] = useState<number>(memberProgress.progressPercent || 0);

  // 個人歷程札記 (支援時間戳記、單元標記與展開/完全收折，預設收折)
  const [reflections, setReflections] = useState<PMLearningReflectionItem[]>(
    Array.isArray(memberProgress.reflections) ? memberProgress.reflections : []
  );
  const [isReflectionsExpanded, setIsReflectionsExpanded] = useState<boolean>(false);
  const [isAddingReflection, setIsAddingReflection] = useState<boolean>(false);
  const [newReflectionContent, setNewReflectionContent] = useState<string>('');
  const [newReflectionUnit, setNewReflectionUnit] = useState<string>('');
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [editingUnit, setEditingUnit] = useState<string>('');

  const [checklist, setChecklist] = useState<PMLearningChecklistItem[]>(
    Array.isArray(memberProgress.checklist) ? memberProgress.checklist : []
  );
  const [newCheckText, setNewCheckText] = useState<string>('');
  const [newSubUnitTexts, setNewSubUnitTexts] = useState<Record<string, string>>({});
  const [newChapterText, setNewChapterText] = useState<string>('');
  const [attachments, setAttachments] = useState<PMLearningAttachment[]>(
    Array.isArray(memberProgress.attachments) ? memberProgress.attachments : []
  );
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 上傳電腦檔案至 Google 雲端專案-Map 資料夾狀態
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState<boolean>(false);
  const [uploadProgressInfo, setUploadProgressInfo] = useState<{
    percent: number;
    stageMessage: string;
    currentFileName: string;
    index: number;
    total: number;
  } | null>(null);

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
  const currentChecklistKey = JSON.stringify(memberProgress.checklist || []);
  const currentAttachmentsKey = JSON.stringify(rawProgress?.attachments || []);
  const currentReflectionsKey = JSON.stringify(memberProgress.reflections || []);

  // 大單元與子單元標題線上編輯狀態
  const [editingChapterOriginal, setEditingChapterOriginal] = useState<string | null>(null);
  const [editingChapterInput, setEditingChapterInput] = useState<string>('');
  const [editingSubUnitId, setEditingSubUnitId] = useState<string | null>(null);
  const [editingSubUnitInput, setEditingSubUnitInput] = useState<string>('');

  // 供心得札記下拉選單引用的單元/章節清單
  const availableUnitOptions = useMemo(() => {
    const list: string[] = ['全課總結 / 綜合心得'];
    const seen = new Set<string>(['全課總結 / 綜合心得']);

    checklist.forEach((item) => {
      const ct = (item.chapterTitle || '').trim();
      if (ct && !seen.has(ct)) {
        seen.add(ct);
        list.push(ct);
      }
      const title = (item.title || '').trim();
      if (title && !isPlaceholderSubUnitTitle(title, ct, 1) && !seen.has(title)) {
        seen.add(title);
        list.push(title);
      }
    });

    return list;
  }, [checklist]);

  useEffect(() => {
    setProgressVal(currentProgressPercent);
  }, [currentProgressPercent]);

  useEffect(() => {
    try {
      setReflections(JSON.parse(currentReflectionsKey));
    } catch {
      setReflections([]);
    }
  }, [currentReflectionsKey]);

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
          defaultChecklist:
            patch.checklist !== undefined
              ? checklistItemsToChapters(patch.checklist, course.defaultChecklist)
              : course.defaultChecklist,
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

  // 將成員檢核清單依第一階「大單元」分組呈現
  const groupedChapters = useMemo(() => {
    const groups: {
      chapterTitle: string;
      items: PMLearningChecklistItem[];
    }[] = [];
    const map = new Map<string, PMLearningChecklistItem[]>();
    const standaloneItems: PMLearningChecklistItem[] = [];

    (checklist || []).forEach((item) => {
      const cTitle = (item?.chapterTitle || '').trim();
      if (cTitle) {
        if (!map.has(cTitle)) {
          const list: PMLearningChecklistItem[] = [];
          map.set(cTitle, list);
          groups.push({
            chapterTitle: cTitle,
            items: list,
          });
        }
        map.get(cTitle)!.push(item);
      } else {
        standaloneItems.push(item);
      }
    });

    if (standaloneItems.length > 0) {
      groups.push({
        chapterTitle: groups.length > 0 ? '其他單元' : '',
        items: standaloneItems,
      });
    }

    return groups;
  }, [checklist]);

  // 判斷某個分組是否真正具備子單元（若僅有 1 筆且標題等同大單元標題或為舊版 2.1/3.1 預設值，視為「無子標題之大單元」）
  const checkGroupHasSubUnits = (group: { chapterTitle: string; items: PMLearningChecklistItem[] }) => {
    if (!group.chapterTitle) return true;
    if (
      group.items.length === 1 &&
      isPlaceholderSubUnitTitle(group.items[0]?.title, group.chapterTitle, 1)
    ) {
      return false;
    }
    return group.items.length > 0;
  };

  // 各大單元個別展開/縮回狀態 (有子單元者預設展開 true，無子單元者預設收起 false，點擊可展開新增子單元)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const isChapterExpanded = (chapterTitle: string, hasSubUnits: boolean = true) => {
    if (expandedChapters[chapterTitle] !== undefined) {
      return expandedChapters[chapterTitle];
    }
    return hasSubUnits;
  };

  const handleToggleChapterExpand = (chapterTitle: string, hasSubUnits: boolean = true) => {
    const current = isChapterExpanded(chapterTitle, hasSubUnits);
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterTitle]: !current,
    }));
  };

  const areAllChaptersExpanded = useMemo(() => {
    return groupedChapters.every((g) => {
      if (!g.chapterTitle) return true;
      const hasSubs = checkGroupHasSubUnits(g);
      return isChapterExpanded(g.chapterTitle, hasSubs);
    });
  }, [groupedChapters, expandedChapters]);

  const handleToggleAllChapters = () => {
    const nextState = !areAllChaptersExpanded;
    const nextMap: Record<string, boolean> = {};
    groupedChapters.forEach((g) => {
      if (g.chapterTitle) {
        nextMap[g.chapterTitle] = nextState;
      }
    });
    setExpandedChapters(nextMap);
  };

  // 2. 切換檢核項目
  const handleToggleCheck = (checkId: string) => {
    const updated = checklist.map((c) =>
      c.id === checkId ? { ...c, completed: !c.completed } : c
    );
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 全選或取消全選特定大單元底下的所有子單元 (或直接勾選無子單元之大單元)
  const handleToggleChapterAll = (chapterTitle: string) => {
    const targetItems = checklist.filter(
      (c) => (c.chapterTitle || '').trim() === chapterTitle.trim()
    );
    if (targetItems.length === 0) return;
    const allCompleted = targetItems.every((c) => c.completed);
    const updated = checklist.map((c) => {
      if ((c.chapterTitle || '').trim() === chapterTitle.trim()) {
        return { ...c, completed: !allCompleted };
      }
      return c;
    });
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 上下移動大單元順序
  const handleMoveChapter = (groupIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? groupIdx - 1 : groupIdx + 1;
    if (targetIdx < 0 || targetIdx >= groupedChapters.length) return;
    const nextGroups = [...groupedChapters];
    const temp = nextGroups[groupIdx];
    nextGroups[groupIdx] = nextGroups[targetIdx];
    nextGroups[targetIdx] = temp;

    const updated = nextGroups.flatMap((g) => g.items);
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 上下移動子單元順序
  const handleMoveSubUnit = (chapterTitle: string, itemIdxInGroup: number, direction: 'up' | 'down') => {
    const nextGroups = groupedChapters.map((g) => {
      if (g.chapterTitle !== chapterTitle) return g;
      const targetIdx = direction === 'up' ? itemIdxInGroup - 1 : itemIdxInGroup + 1;
      if (targetIdx < 0 || targetIdx >= g.items.length) return g;
      const nextItems = [...g.items];
      const temp = nextItems[itemIdxInGroup];
      nextItems[itemIdxInGroup] = nextItems[targetIdx];
      nextItems[targetIdx] = temp;
      return {
        ...g,
        items: nextItems,
      };
    });

    const updated = nextGroups.flatMap((g) => g.items);
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 修改並儲存大單元標題
  const handleSaveChapterTitle = (oldChapterTitle: string) => {
    const newTitle = editingChapterInput.trim();
    if (!newTitle) {
      toast({ title: '大單元標題不可為空', variant: 'destructive' });
      return;
    }
    if (newTitle === oldChapterTitle) {
      setEditingChapterOriginal(null);
      return;
    }

    const groupItems = checklist.filter(
      (c) => (c.chapterTitle || '').trim() === oldChapterTitle.trim()
    );
    const isSinglePlaceholder =
      groupItems.length === 1 &&
      isPlaceholderSubUnitTitle(groupItems[0]?.title, oldChapterTitle, 1);

    const updated = checklist.map((c) => {
      if ((c.chapterTitle || '').trim() === oldChapterTitle.trim()) {
        return {
          ...c,
          chapterTitle: newTitle,
          title: isSinglePlaceholder ? newTitle : c.title,
        };
      }
      return c;
    });

    setExpandedChapters((prev) => {
      const next = { ...prev };
      if (next[oldChapterTitle] !== undefined) {
        next[newTitle] = next[oldChapterTitle];
        delete next[oldChapterTitle];
      }
      return next;
    });
    setEditingChapterOriginal(null);
    setEditingChapterInput('');
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
    toast({ title: '已更新大單元標題', description: `已修改為「${newTitle}」` });
  };

  // 修改並儲存子單元標題
  const handleSaveSubUnitTitle = (checkId: string) => {
    const newTitle = editingSubUnitInput.trim();
    if (!newTitle) {
      toast({ title: '子單元標題不可為空', variant: 'destructive' });
      return;
    }
    const updated = checklist.map((c) =>
      c.id === checkId ? { ...c, title: newTitle } : c
    );
    setEditingSubUnitId(null);
    setEditingSubUnitInput('');
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
    toast({ title: '已更新子單元標題', description: `已修改為「${newTitle}」` });
  };

  // 刪除整個大單元
  const handleDeleteChapter = (chapterTitle: string) => {
    const updated = checklist.filter(
      (c) => (c.chapterTitle || '').trim() !== chapterTitle.trim()
    );
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
    toast({ title: '已刪除大單元', description: `已移除「${chapterTitle}」` });
  };

  // 新增子單元至特定大單元
  const handleAddSubUnitToChecklist = (chapterTitle: string) => {
    const text = (newSubUnitTexts[chapterTitle] || '').trim();
    if (!text) return;

    const targetChapter = chapterTitle.trim();
    const newItem: PMLearningChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: text,
      chapterTitle: targetChapter,
      completed: false,
    };

    const nextGroups = groupedChapters.map((g) => {
      if (g.chapterTitle !== targetChapter) return g;
      const isSinglePlaceholder =
        g.items.length === 1 &&
        isPlaceholderSubUnitTitle(g.items[0]?.title, targetChapter, 1);
      return {
        ...g,
        items: isSinglePlaceholder ? [newItem] : [...g.items, newItem],
      };
    });

    const updated = nextGroups.flatMap((g) => g.items);
    setChecklist(updated);
    setExpandedChapters((prev) => ({ ...prev, [targetChapter]: true }));
    setNewSubUnitTexts((prev) => ({ ...prev, [chapterTitle]: '' }));
    saveProgressPatch({ checklist: updated });
  };

  // 新增大單元 (不自動產生 1.1, 2.1, 3.1 子標題！直接以大單元本身作為檢核項)
  const handleAddChapterToChecklist = () => {
    const defaultName = `單元 ${groupedChapters.length + 1}`;
    const chapterName = newChapterText.trim() || defaultName;

    const newItem: PMLearningChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: chapterName,
      chapterTitle: chapterName,
      completed: false,
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    setNewChapterText('');
    saveProgressPatch({ checklist: updated });
    toast({
      title: '已新增大單元',
      description: `已成功新增「${chapterName}」`,
    });
  };

  // 新增獨立檢核項 (相容既有單一單元)
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

  // 刪除子單元檢核項 (若為某大單元下最後一個子單元，保留大單元本身轉為無子標題狀態，避免誤刪整個大單元)
  const handleDeleteCheckItem = (checkId: string) => {
    const target = checklist.find((c) => c.id === checkId);
    if (!target) return;
    const cTitle = (target.chapterTitle || '').trim();
    if (cTitle) {
      const sameChapterItems = checklist.filter(
        (c) => (c.chapterTitle || '').trim() === cTitle
      );
      if (
        sameChapterItems.length === 1 &&
        !isPlaceholderSubUnitTitle(target.title, cTitle, 1)
      ) {
        const updated = checklist.map((c) =>
          c.id === checkId ? { ...c, title: cTitle, completed: false } : c
        );
        setChecklist(updated);
        setExpandedChapters((prev) => ({ ...prev, [cTitle]: false }));
        saveProgressPatch({ checklist: updated });
        return;
      }
    }

    const updated = checklist.filter((c) => c.id !== checkId);
    setChecklist(updated);
    saveProgressPatch({ checklist: updated });
  };

  // 3. 歷程札記操作
  const handleAddReflection = () => {
    if (!newReflectionContent.trim()) {
      toast({ title: '請輸入心得或想法內容', variant: 'destructive' });
      return;
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newRef: PMLearningReflectionItem = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: timeStr,
      content: newReflectionContent.trim(),
      relatedUnit: newReflectionUnit.trim() || undefined,
    };

    const updated = [newRef, ...reflections];
    setReflections(updated);
    setNewReflectionContent('');
    setNewReflectionUnit('');
    setIsAddingReflection(false);
    setIsReflectionsExpanded(true);

    // 同步更新 reflections 與 notes 欄位 (向下相容)
    const compiledNotes = updated
      .map((r) => `### 📅 ${r.createdAt}${r.relatedUnit ? ` [${r.relatedUnit}]` : ''}\n${r.content}`)
      .join('\n\n---\n\n');

    saveProgressPatch({
      reflections: updated,
      notes: compiledNotes,
    });
    toast({ title: '心得札記已儲存', description: '已成功記錄至您的個人研習歷程！' });
  };

  const handleStartEditReflection = (item: PMLearningReflectionItem) => {
    setEditingReflectionId(item.id);
    setEditingContent(item.content);
    setEditingUnit(item.relatedUnit || '');
  };

  const handleCancelEditReflection = () => {
    setEditingReflectionId(null);
    setEditingContent('');
    setEditingUnit('');
  };

  const handleSaveEditReflection = (id: string) => {
    if (!editingContent.trim()) {
      toast({ title: '心得內容不可為空', variant: 'destructive' });
      return;
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const updateTimeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const updated = reflections.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          content: editingContent.trim(),
          relatedUnit: editingUnit.trim() || undefined,
          updatedAt: updateTimeStr,
        };
      }
      return r;
    });

    setReflections(updated);
    setEditingReflectionId(null);
    setEditingContent('');
    setEditingUnit('');

    const compiledNotes = updated
      .map((r) => `### 📅 ${r.createdAt}${r.relatedUnit ? ` [${r.relatedUnit}]` : ''}\n${r.content}`)
      .join('\n\n---\n\n');

    saveProgressPatch({
      reflections: updated,
      notes: compiledNotes,
    });
    toast({ title: '心得札記已更新' });
  };

  const handleDeleteReflection = (id: string) => {
    const updated = reflections.filter((r) => r.id !== id);
    setReflections(updated);

    const compiledNotes = updated
      .map((r) => `### 📅 ${r.createdAt}${r.relatedUnit ? ` [${r.relatedUnit}]` : ''}\n${r.content}`)
      .join('\n\n---\n\n');

    saveProgressPatch({
      reflections: updated,
      notes: compiledNotes,
    });
    toast({ title: '心得札記已刪除' });
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

  // 5. 從電腦上傳檔案至 Google 雲端專案-Map 資料夾
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    e.target.value = ''; // 清空以利後續再次選取同名檔案

    setIsUploadingFiles(true);
    const memberName =
      memberProgress.userName || currentUser?.displayName || currentUser?.username || '成員';
    let currentAttachmentsList = [...attachments];
    let successCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const targetFileName = formatLearningFileName(file.name);

        setUploadProgressInfo({
          percent: 5,
          stageMessage: `正在準備上傳 (${i + 1}/${fileList.length})...`,
          currentFileName: targetFileName,
          index: i + 1,
          total: fileList.length,
        });

        try {
          const newAtt = await uploadPMLearningFile(
            file,
            targetFileName,
            (prog) => {
              setUploadProgressInfo({
                percent: prog.percent,
                stageMessage: prog.stageMessage,
                currentFileName: targetFileName,
                index: i + 1,
                total: fileList.length,
              });
            },
            {
              courseId: course.id,
              courseTitle: course.title,
            }
          );

          currentAttachmentsList = [...currentAttachmentsList, newAtt];
          setAttachments(currentAttachmentsList);
          successCount++;
        } catch (fileErr: any) {
          console.error(`檔案「${file.name}」上傳失敗:`, fileErr);
          toast({
            title: `檔案「${file.name}」上傳失敗`,
            description: fileErr?.message || '上傳至 Google 雲端硬碟時發生錯誤',
            variant: 'destructive',
          });
        }
      }

      if (successCount > 0) {
        saveProgressPatch({ attachments: currentAttachmentsList });
        toast({
          title: '檔案已成功上傳至 Google 雲端！',
          description: `已成功將 ${successCount} 個成果附件存入專案-Map 雲端資料夾。`,
        });
      }
    } catch (err: any) {
      console.error('上傳處理異常:', err);
      toast({
        title: '上傳處理異常',
        description: err?.message || '發生未預期的上傳錯誤',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingFiles(false);
      setUploadProgressInfo(null);
    }
  };

  // 判斷當前項目是否置頂 (優先採用個人自訂置頂，若無則採用課程全域置頂)
  const isPinned = Boolean(
    memberProgress.isPinned !== undefined
      ? memberProgress.isPinned
      : course.isPinned
  );

  // 切換置頂狀態
  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPinned = !isPinned;
    saveProgressPatch({ isPinned: nextPinned });
    toast({
      title: nextPinned ? '📌 已成功置頂' : '已取消置頂',
      description: nextPinned
        ? `「${course.title}」已置頂至清單最頂部！`
        : `已取消「${course.title}」之置頂狀態`,
    });
  };

  const isFinished = progressVal >= 100 || memberProgress.isCompleted;

  return (
    <div
      className={`rounded-xl border shadow-2xs overflow-hidden transition-all ${
        isPinned
          ? 'ring-2 ring-amber-400 border-amber-400/90 bg-amber-50/20 hover:border-amber-500 shadow-amber-100'
          : isFinished
          ? 'bg-blue-50/75 border-blue-300 hover:border-blue-400'
          : progressVal > 0
          ? 'bg-amber-50/75 border-amber-300 hover:border-amber-400'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* 卡片頂部條 (Header：包含上下排序、名稱、領域、狀態、進度%、日期、時數與符號操作按鈕) */}
      <div
        className={`p-3 sm:p-3.5 transition-colors ${
          isPinned
            ? 'bg-linear-to-r from-amber-100/90 via-amber-50/70 to-yellow-50/40 border-b border-amber-200/60'
            : isFinished
            ? 'bg-linear-to-r from-blue-100/70 via-blue-50/70 to-indigo-50/40'
            : progressVal > 0
            ? 'bg-linear-to-r from-amber-100/70 via-amber-50/70 to-yellow-50/40'
            : 'bg-linear-to-r from-white via-slate-50/50 to-indigo-50/20'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* 左側：排序控制 + 課程標題 + 分類 + 狀態 + 進度% + 日期 + 時數 */}
          <div className="flex items-start gap-2.5 sm:gap-3.5 flex-1 min-w-0">
            {/* 上下移動箭頭 (個人自訂排序) */}
            <div className="flex flex-col gap-0.5 shrink-0 pt-0.5" title={canManualSort ? "個人自訂課程呈現順序" : "目前依進度或發布日期排序中"}>
              <button
                type="button"
                disabled={!canManualSort || isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveCourse('up');
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title={!canManualSort ? '目前依【進度或發布日期】排序中，請切換至「自訂排序」以手動上下調整順序' : '向上移動'}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!canManualSort || isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveCourse('down');
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title={!canManualSort ? '目前依【進度或發布日期】排序中，請切換至「自訂排序」以手動上下調整順序' : '向下移動'}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              {/* 第一行：載體型態 + 置頂標籤 + 標題 + 領域 + 出刊期別 + 時效性 + 狀態 + 進度% + 日期 + 時數 */}
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

                {/* 📌 置頂標籤 Badge */}
                {isPinned && (
                  <Badge className="text-xs shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-bold shadow-2xs flex items-center gap-1">
                    <Pin className="h-3 w-3 fill-white text-white" />
                    <span>置頂</span>
                  </Badge>
                )}

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

                {/* 系列篇目標籤 (若為文章且包含篇目) */}
                {course.type === 'article' && checklist.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 font-bold shrink-0">
                    📚 系列專題 ({checklist.filter((c) => c.completed).length}/{checklist.length} 篇已讀)
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
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : progressVal > 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isFinished ? '✅ 已研讀完畢' : progressVal > 0 ? `⚡ 研讀中` : '📌 待啟動'}
                </Badge>

                {/* 進度 % (明確放在課程名稱旁邊) */}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
                    isFinished
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : progressVal > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
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

          {/* 右側操作群：符號化按鈕 (閱讀全文、原文網址、編輯筆、刪除、展開符號) */}
          <div className="shrink-0 flex items-center gap-1.5 self-end lg:self-center pl-7 lg:pl-0">
            {/* 統一「研讀重點 / 閱讀全文」與「向 AI 提問」符號按鈕 (所有載體型態皆一致支援) */}
            <div className="inline-flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReader(course, false);
                }}
                className={`h-8 px-2 rounded-lg text-white font-bold text-xs shadow-2xs transition-all active:scale-95 inline-flex items-center gap-1 shrink-0 ${
                  course.type === 'book'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : course.type === 'video'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : course.type === 'course'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                title={
                  course.type === 'book'
                    ? '📖 研讀書籍重點（點擊開啟重點研讀視窗與 AI 導讀）'
                    : course.type === 'video'
                    ? '🎥 研讀影音重點（點擊開啟重點研讀視窗與 AI 導讀）'
                    : course.type === 'course'
                    ? '🎓 研讀課程重點（點擊開啟講義研讀視窗與 AI 導讀）'
                    : '📄 閱讀全文（點擊開啟沉浸式閱讀視窗與 AI 導讀）'
                }
              >
                <FileText className="h-3.5 w-3.5" />
                {course.aiAnalysis?.summary && <Sparkles className="h-3 w-3 text-amber-300" />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReader(course, true);
                }}
                className="h-8 px-2 rounded-lg border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 shadow-2xs transition-all active:scale-95 inline-flex items-center gap-1 shrink-0"
                title="💬 向 GPT-6 Luna AI 提問（針對此內容深入探討）"
              >
                <MessageSquareQuote className="h-3.5 w-3.5 text-purple-600" />
              </Button>
            </div>

            {/* 外部傳送門 / 原文網址符號按鈕 */}
            {course.externalUrl && (
              <a
                href={course.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all active:scale-95 inline-flex items-center justify-center shrink-0"
                title={
                  course.externalUrl.includes('drive.google.com')
                    ? '📁 開啟 Google 雲端硬碟教材 / 共用資料夾'
                    : course.type === 'video'
                    ? '🚀 前往觀看外部影音'
                    : course.type === 'article'
                    ? '🔗 前往原始文章網址'
                    : '🚀 前往外部平台傳送門'
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {/* 置頂切換按鈕 (Pin to top) */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTogglePin}
              className={`h-8 px-2 rounded-lg font-bold text-xs shadow-2xs transition-all active:scale-95 inline-flex items-center gap-1 shrink-0 ${
                isPinned
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-200'
                  : 'border-slate-200 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 hover:border-amber-300'
              }`}
              title={isPinned ? '📌 目前已置頂，點擊取消置頂' : '📌 點擊置頂此項目至清單最頂部'}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-white text-white' : 'text-slate-500'}`} />
              <span>{isPinned ? '已置頂' : '置頂'}</span>
            </Button>

            {/* 課程編輯與刪除權限 (符號筆與垃圾桶) */}
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCourse(course)}
                  className="h-8 w-8 p-0 text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-2xs shrink-0"
                  title="✏️ 編輯課程資訊（名稱、來源、期程與時數）"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteCourse(course.id, course.title)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                  title="🗑️ 刪除此項目"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* 展開 / 收合詳情符號按鈕 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCardExpanded((prev) => !prev)}
              className="h-8 w-8 p-0 text-slate-700 border-slate-300 hover:bg-slate-100 shadow-2xs shrink-0"
              title={isCardExpanded ? '▴ 收合詳情' : '▾ 展開詳情（章節檢核、心得筆記與進度調整）'}
            >
              {isCardExpanded ? (
                <ChevronUp className="h-4 w-4 text-indigo-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-indigo-600" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 展開時才顯示詳細資訊與操作項目 (進度滑桿、章節檢核、心得筆記、成果連結) */}
      {isCardExpanded && (
        <div
          className={`p-4 sm:p-5 space-y-4 border-t transition-colors ${
            isFinished
              ? 'border-blue-200/80 bg-blue-50/30'
              : progressVal > 0
              ? 'border-amber-200/80 bg-amber-50/30'
              : 'border-slate-100 bg-white'
          }`}
        >
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

          {/* 四大載體通用：重點導讀與 AI 提問卡片 (架構完全一致) */}
          <div
            className={`p-4 rounded-xl border space-y-3 transition-colors ${
              course.type === 'book'
                ? 'bg-amber-50/60 border-amber-200/80'
                : course.type === 'video'
                ? 'bg-rose-50/60 border-rose-200/80'
                : course.type === 'course'
                ? 'bg-indigo-50/60 border-indigo-200/80'
                : 'bg-emerald-50/60 border-emerald-200/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    course.type === 'book'
                      ? 'bg-amber-600 text-white text-xs'
                      : course.type === 'video'
                      ? 'bg-rose-600 text-white text-xs'
                      : course.type === 'course'
                      ? 'bg-indigo-600 text-white text-xs'
                      : 'bg-emerald-600 text-white text-xs'
                  }
                >
                  {course.type === 'book'
                    ? '📖 個人閱讀 (重點摘錄與反思)'
                    : course.type === 'video'
                    ? '🎥 影音資源 (重點時戳筆記)'
                    : course.type === 'course'
                    ? '🎓 線上課程 (核心講義大綱)'
                    : '📄 付費知識文章 (全文已收錄)'}
                </Badge>

                {Boolean(course.content || course.bookQuotesAndReflections || course.videoTimestampNotes) && (
                  <Badge
                    variant="outline"
                    className="bg-white text-slate-700 border-slate-300 font-medium text-xs"
                  >
                    ✍️ 已收錄重點內文
                  </Badge>
                )}

                {course.issueDate && (
                  <Badge
                    variant="outline"
                    className="bg-white text-slate-800 border-slate-300 font-mono text-xs"
                  >
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

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onOpenReader(course, false)}
                  className={`h-8 font-bold text-xs gap-1.5 shadow-2xs text-white ${
                    course.type === 'book'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : course.type === 'video'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : course.type === 'course'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {course.type === 'article'
                      ? '開啟沉浸式閱讀視窗'
                      : course.type === 'book'
                      ? '開啟重點研讀視窗'
                      : course.type === 'video'
                      ? '開啟影音研讀視窗'
                      : '開啟講義研讀視窗'}
                  </span>
                  {course.aiAnalysis?.summary && <Sparkles className="w-3 h-3 text-amber-300" />}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenReader(course, true)}
                  className="h-8 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs gap-1.5 shadow-2xs"
                  title="向 GPT-6 Luna AI 提問與深度探討"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-purple-600" />
                  <span>向 AI 提問</span>
                </Button>
              </div>
            </div>

            {/* AI 導讀重點速覽或預覽說明 */}
            {course.aiAnalysis?.summary ? (
              <div className="bg-white rounded-lg p-3 border border-slate-200/80 text-xs text-slate-700 space-y-1.5 shadow-2xs">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI 導讀重點速覽：</span>
                </div>
                <p className="line-clamp-3 leading-relaxed text-slate-700">
                  {course.aiAnalysis.summary}
                </p>
              </div>
            ) : (course.content || course.videoTimestampNotes || course.bookQuotesAndReflections) ? (
              <div className="bg-white/90 rounded-lg p-3 border border-slate-200/70 text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>核心重點內容預覽：</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenReader(course, false)}
                    className="text-[11px] text-indigo-600 hover:underline font-bold"
                  >
                    開啟完整視窗 ↗
                  </button>
                </div>
                <p className="line-clamp-2 leading-relaxed text-slate-600 font-mono text-[11px]">
                  {(course.content || course.bookQuotesAndReflections || course.videoTimestampNotes || '').slice(0, 160)}...
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                {course.description ||
                  `本項目已建立於系統中。點選上方「${
                    course.type === 'article'
                      ? '開啟沉浸式閱讀視窗'
                      : course.type === 'book'
                      ? '開啟重點研讀視窗'
                      : course.type === 'video'
                      ? '開啟影音研讀視窗'
                      : '開啟講義研讀視窗'
                  }」可查閱重點、記錄心得並執行 AI 導讀，或點選「向 AI 提問」與 GPT-6 Luna 深入探討。`}
              </p>
            )}
          </div>

          {/* 影音額外筆記 (若有獨立填寫) */}
          {course.type === 'video' && course.videoTimestampNotes && course.videoTimestampNotes !== course.content && (
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

          {/* 個人閱讀額外行動清單 (若有獨立填寫) */}
          {course.type === 'book' && course.bookQuotesAndReflections && course.bookQuotesAndReflections !== course.content && (
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

          {course.type === 'article' ? (
            /* 個人知識文章：專屬極簡閱讀進度與系列專題篇章 (無冗贅換算器、無複雜大/小單元表單) */
            <div className="space-y-3">
              {checklist.length > 0 ? (
                /* 系列專題篇章清單 (可縮起 / 展開) */
                <div className="border border-emerald-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div
                    onClick={() => setIsChaptersExpanded((prev) => !prev)}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-50/60 hover:bg-emerald-50 cursor-pointer select-none transition-colors border-b border-emerald-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          📚 系列專題篇章清單
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          (已讀 {checklist.filter((c) => c.completed).length} / {checklist.length} 篇 · 完成度 {progressVal}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isFinished) {
                            handleResetProgress();
                          } else {
                            handleMarkComplete();
                          }
                        }}
                        className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-medium"
                      >
                        {isFinished ? '重設為未讀' : '全部標記完讀'}
                      </Button>
                      <div className="p-1 rounded-md bg-white border border-emerald-200 text-slate-500 shadow-2xs">
                        {isChaptersExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>

                  {isChaptersExpanded && (
                    <div className="p-3.5 space-y-2 bg-slate-50/30">
                      {checklist.map((item, idx) => (
                        <div
                          key={item?.id || idx}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                            item?.completed
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-500'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-300'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                            <Checkbox
                              checked={Boolean(item?.completed)}
                              onCheckedChange={() => {
                                if (item?.id) {
                                  handleToggleCheck(item.id);
                                }
                              }}
                            />
                            <span className={`truncate ${item?.completed ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-semibold'}`}>
                              第 {idx + 1} 篇：{item?.title}
                            </span>
                          </label>

                          <div className="flex items-center gap-2 shrink-0 pl-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onOpenReader(course, false, idx)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 px-2.5 shadow-2xs"
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>進入閱讀</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 單篇文章狀態列 */
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">閱讀進度狀態：</span>
                    <Badge className={isFinished ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}>
                      {isFinished ? '✅ 已研讀完畢 (100%)' : '📖 尚未研讀 (0%)'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={isFinished ? handleResetProgress : handleMarkComplete}
                      className="h-7 text-xs gap-1 border-slate-300"
                    >
                      <CheckCircle2 className={`h-3 w-3 ${isFinished ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{isFinished ? '標記為未讀' : '標記為已讀完畢'}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onOpenReader(course, false)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-2xs"
                    >
                      <FileText className="h-3 w-3" />
                      <span>開啟閱讀全文</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 1. 進度條（手動拉 % 或一鍵勾選完成） */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">個人學習進度：</span>
                    <span
                      className={`text-lg font-extrabold ${
                        isFinished ? 'text-blue-600' : progressVal > 0 ? 'text-amber-600' : 'text-slate-500'
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
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
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
                      {course.type === 'book'
                        ? '書籍章節單元清單'
                        : course.type === 'video'
                        ? '影音重點段落清單'
                        : '課程章節單元'}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${
                        checklist.filter((c) => c.completed).length === checklist.length && checklist.length > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {checklist.filter((c) => c.completed).length} / {checklist.length}{' '}
                      {course.type === 'book' ? '章節已讀' : '單元已達成'}
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

                {/* 展開時才顯示完整的兩階章節單元清單 (保留核取方格與個別章節展開/縮回) */}
                {isChaptersExpanded && (
                  <div className="p-3.5 space-y-3 bg-slate-50/40 border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-xs text-slate-500">
                      <span>點選核取方格標記已完成之子單元：</span>
                      <div className="flex items-center gap-2">
                        {groupedChapters.some((g) => Boolean(g.chapterTitle)) && (
                          <button
                            type="button"
                            onClick={handleToggleAllChapters}
                            className="text-xs text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
                          >
                            {areAllChaptersExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                                <span>縮回全部大單元</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                                <span>展開全部大單元</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutoCalcFromChecklist();
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
                          title="根據章節單元完成比例自動換算上方進度百分比"
                        >
                          <Calculator className="h-3.5 w-3.5" />
                          <span>依單元換算進度</span>
                        </button>
                      </div>
                    </div>

                    {/* 無單元狀態 */}
                    {checklist.length === 0 ? (
                      <div className="text-center py-5 bg-white rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 space-y-1">
                        <Layers className="h-5 w-5 mx-auto text-slate-300" />
                        <p>此項目目前尚無章節單元清單</p>
                        <p className="text-[11px] text-slate-400">可於下方建立第一個大單元 (如：單元 1)</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {groupedChapters.map((group, gIdx) => {
                          const isStandalone = !group.chapterTitle;
                          const hasSubUnits = checkGroupHasSubUnits(group);
                          const completedCount = group.items.filter((c) => c.completed).length;
                          const allDone = completedCount === group.items.length && group.items.length > 0;
                          const isExpanded = isStandalone || isChapterExpanded(group.chapterTitle, hasSubUnits);
                          const isEditingThisChapter = editingChapterOriginal === group.chapterTitle;

                          return (
                            <div
                              key={group.chapterTitle || `group-${gIdx}`}
                              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-0 hover:border-indigo-300 transition-all"
                            >
                              {/* 第一階：大單元標題與排序、編輯、展開/縮回控制列 */}
                              {!isStandalone ? (
                                <div
                                  onClick={() => handleToggleChapterExpand(group.chapterTitle, hasSubUnits)}
                                  className={`flex flex-wrap items-center justify-between gap-2 p-3 cursor-pointer select-none transition-colors ${
                                    isExpanded ? 'border-b border-slate-100' : ''
                                  } ${
                                    !hasSubUnits && allDone
                                      ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                                      : 'bg-slate-50/70 hover:bg-slate-100/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {/* 大單元上下排序按鈕 */}
                                    <div
                                      className="flex flex-col gap-0.5 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        disabled={gIdx === 0}
                                        onClick={() => handleMoveChapter(gIdx, 'up')}
                                        className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                        title="向上移動此大單元"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={gIdx === groupedChapters.length - 1}
                                        onClick={() => handleMoveChapter(gIdx, 'down')}
                                        className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                        title="向下移動此大單元"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* 展開/縮回圖示 */}
                                    <div className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 shadow-2xs shrink-0">
                                      {isExpanded ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                                      ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                      )}
                                    </div>

                                    {/* 大單元直接勾選核取方格 */}
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center shrink-0"
                                      title={hasSubUnits ? '全選 / 取消全選此大單元所有子單元' : '標記此大單元為已完成'}
                                    >
                                      <Checkbox
                                        checked={allDone}
                                        onCheckedChange={() => handleToggleChapterAll(group.chapterTitle)}
                                      />
                                    </div>

                                    <span className="p-1 rounded bg-indigo-50 text-indigo-700 shrink-0">
                                      <BookOpen className="h-3.5 w-3.5" />
                                    </span>

                                    {/* 大單元標題 或 標題編輯輸入框 */}
                                    {isEditingThisChapter ? (
                                      <div
                                        className="flex items-center gap-1.5 flex-1 min-w-[180px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Input
                                          value={editingChapterInput}
                                          onChange={(e) => setEditingChapterInput(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveChapterTitle(group.chapterTitle);
                                            } else if (e.key === 'Escape') {
                                              setEditingChapterOriginal(null);
                                            }
                                          }}
                                          className="h-7 text-xs font-bold bg-white border-indigo-300 flex-1"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveChapterTitle(group.chapterTitle)}
                                          className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shrink-0"
                                          title="確認修改標題"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingChapterOriginal(null)}
                                          className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0"
                                          title="取消"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span
                                          className={`text-xs font-bold truncate ${
                                            !hasSubUnits && allDone
                                              ? 'line-through text-slate-400'
                                              : 'text-slate-800'
                                          }`}
                                        >
                                          {group.chapterTitle}
                                        </span>
                                        {hasSubUnits ? (
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] font-semibold shrink-0 ${
                                              allDone
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                : completedCount > 0
                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                          >
                                            {completedCount} / {group.items.length} 子單元完成
                                          </Badge>
                                        ) : (
                                          allDone && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] font-semibold shrink-0 bg-emerald-50 text-emerald-700 border-emerald-300"
                                            >
                                              已完成
                                            </Badge>
                                          )
                                        )}
                                      </>
                                    )}
                                  </div>

                                  <div
                                    className="flex items-center gap-1.5 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {hasSubUnits ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChapterAll(group.chapterTitle)}
                                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-1 py-0.5"
                                      >
                                        {allDone ? '取消全選' : '全選此單元'}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChapterExpand(group.chapterTitle, hasSubUnits)}
                                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-1.5 py-0.5 rounded hover:bg-indigo-50 flex items-center gap-0.5"
                                        title="在此大單元下新增子單元 (選填)"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span>{isExpanded ? '收起子單元欄' : '新增子單元'}</span>
                                      </button>
                                    )}

                                    {/* 修改大單元標題按鈕 */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingChapterOriginal(group.chapterTitle);
                                        setEditingChapterInput(group.chapterTitle);
                                      }}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                      title="修改此大單元標題"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>

                                    {/* 刪除大單元按鈕 */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChapter(group.chapterTitle)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="刪除此大單元"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>

                                    {hasSubUnits && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChapterExpand(group.chapterTitle, hasSubUnits)}
                                        className="text-xs font-medium text-slate-400 hover:text-slate-600 pl-0.5"
                                      >
                                        {isExpanded ? '縮回' : '展開'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 pb-1 text-xs font-bold text-slate-500 border-b border-slate-100">
                                  其他單元
                                </div>
                              )}

                              {/* 第二階：子單元檢核清單與新增子單元列 (展開時才呈現) */}
                              {isExpanded && (
                                <div className="p-3 space-y-2 bg-white">
                                  <div
                                    className={`space-y-1.5 ${
                                      !isStandalone ? 'pl-2 border-l-2 border-indigo-100 ml-1' : ''
                                    }`}
                                  >
                                    {hasSubUnits &&
                                      group.items.map((item, idx) => {
                                        const isEditingThisSub = editingSubUnitId === item?.id;
                                        return (
                                          <div
                                            key={item?.id || `chk-idx-${idx}`}
                                            className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs transition-colors ${
                                              item?.completed
                                                ? 'bg-emerald-50/60 border-emerald-200 text-slate-400'
                                                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              {/* 子單元上下移動排序按鈕 */}
                                              {group.items.length > 1 && (
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                  <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() =>
                                                      handleMoveSubUnit(group.chapterTitle, idx, 'up')
                                                    }
                                                    className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                                    title="向上移動此子單元"
                                                  >
                                                    <ArrowUp className="h-3 w-3" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={idx === group.items.length - 1}
                                                    onClick={() =>
                                                      handleMoveSubUnit(group.chapterTitle, idx, 'down')
                                                    }
                                                    className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                                    title="向下移動此子單元"
                                                  >
                                                    <ArrowDown className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              )}

                                              {isEditingThisSub ? (
                                                <div className="flex items-center gap-1.5 flex-1">
                                                  <Input
                                                    value={editingSubUnitInput}
                                                    onChange={(e) => setEditingSubUnitInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter' && item?.id) {
                                                        e.preventDefault();
                                                        handleSaveSubUnitTitle(item.id);
                                                      } else if (e.key === 'Escape') {
                                                        setEditingSubUnitId(null);
                                                      }
                                                    }}
                                                    className="h-6.5 text-xs bg-white border-indigo-300 flex-1"
                                                    autoFocus
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => item?.id && handleSaveSubUnitTitle(item.id)}
                                                    className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shrink-0"
                                                    title="儲存子單元標題"
                                                  >
                                                    <Check className="h-3 w-3" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingSubUnitId(null)}
                                                    className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0"
                                                    title="取消"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                                                  <Checkbox
                                                    checked={Boolean(item?.completed)}
                                                    onCheckedChange={() =>
                                                      item?.id && handleToggleCheck(item.id)
                                                    }
                                                  />
                                                  <span
                                                    className={
                                                      item?.completed
                                                        ? 'line-through text-slate-400 truncate'
                                                        : 'font-semibold text-slate-800 truncate'
                                                    }
                                                  >
                                                    {item?.title || '單元'}
                                                  </span>
                                                </label>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (item?.id) {
                                                    setEditingSubUnitId(item.id);
                                                    setEditingSubUnitInput(item.title || '');
                                                  }
                                                }}
                                                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors p-1"
                                                title="修改此子單元標題"
                                              >
                                                <Edit3 className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => item?.id && handleDeleteCheckItem(item.id)}
                                                className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors p-1"
                                                title="刪除此子單元"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}

                                    {/* 在此大單元下新增子單元 */}
                                    {!isStandalone && (
                                      <div className="flex gap-1.5 pt-1">
                                        <Input
                                          value={newSubUnitTexts[group.chapterTitle] || ''}
                                          onChange={(e) =>
                                            setNewSubUnitTexts((prev) => ({
                                              ...prev,
                                              [group.chapterTitle]: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddSubUnitToChecklist(group.chapterTitle);
                                            }
                                          }}
                                          placeholder="在此單元新增子單元標題 (選填，若無子標題可不填)..."
                                          className="h-7 text-xs bg-slate-50 flex-1 focus:bg-white"
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleAddSubUnitToChecklist(group.chapterTitle)}
                                          className="h-7 text-xs shrink-0 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1 px-2.5"
                                        >
                                          <Plus className="h-3 w-3" />
                                          新增子單元
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 底部：新增大單元輸入行 */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      <Input
                        value={newChapterText}
                        onChange={(e) => setNewChapterText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChapterToChecklist();
                          }
                        }}
                        placeholder={`新增大單元 (例如：單元 ${groupedChapters.length + 1})...`}
                        className="h-8 text-xs bg-white flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddChapterToChecklist}
                        className="h-8 text-xs shrink-0 text-indigo-700 border-indigo-300 hover:bg-indigo-50 font-bold gap-1 px-3 shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>新增大單元</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. 個人研習歷程與心得札記 (支援時間軸、單元關聯與完全折疊/展開) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                onClick={() => {
                  if (reflections.length > 0) {
                    setIsReflectionsExpanded((prev) => !prev);
                  }
                }}
                className={`flex items-center gap-2 ${
                  reflections.length > 0 ? 'cursor-pointer select-none hover:opacity-80 transition-opacity' : ''
                }`}
                title={
                  reflections.length > 0
                    ? isReflectionsExpanded
                      ? '點擊收合全部研習歷程'
                      : '點擊展開研習歷程'
                    : undefined
                }
              >
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">
                  個人研習歷程與心得札記
                </span>
                <Badge
                  variant="outline"
                  className="text-[11px] text-indigo-700 bg-indigo-50/70 border-indigo-200 font-semibold py-0 px-2"
                >
                  {reflections.length} 則札記
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {reflections.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsReflectionsExpanded(!isReflectionsExpanded)}
                    className="h-7 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 gap-1 font-medium"
                    title={isReflectionsExpanded ? '完全收合研習歷程' : '展開全部研習歷程'}
                  >
                    {isReflectionsExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
                        <span>收合全部歷程</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
                        <span>展開全部歷程 ({reflections.length} 則)</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant={isAddingReflection ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsAddingReflection(!isAddingReflection);
                    if (!isAddingReflection) {
                      setNewReflectionContent('');
                      setNewReflectionUnit('');
                    }
                  }}
                  className={
                    isAddingReflection
                      ? 'h-7 text-xs text-slate-500 gap-1'
                      : 'h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold'
                  }
                >
                  {isAddingReflection ? (
                    <>
                      <X className="h-3 w-3" />
                      <span>取消新增</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>記錄新想法</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 新增札記表單區塊 */}
            {isAddingReflection && (
              <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3.5 space-y-3 shadow-sm animate-in fade-in-50 duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>記錄此刻研習心得與想法</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      （儲存時自動標記當前時間）
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Tag className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-500 font-medium">關聯單元:</span>
                    <select
                      value={newReflectionUnit}
                      onChange={(e) => setNewReflectionUnit(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[220px]"
                    >
                      <option value="">(無特定 / 綜合想法)</option>
                      {availableUnitOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Markdown 快捷工具列 */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                  <span className="text-[10px] text-slate-400 mr-1">快捷工具:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewReflectionContent((prev) => prev + '\n### 💡 重點領悟\n')
                    }
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 font-mono text-[11px]"
                  >
                    H3標題
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewReflectionContent((prev) => prev + '**重要觀念** ')
                    }
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 font-bold text-[11px]"
                  >
                    粗體
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewReflectionContent(
                        (prev) => prev + '\n- 啟發點一\n- 啟發點二\n'
                      )
                    }
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[11px]"
                  >
                    條列
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewReflectionContent(
                        (prev) => prev + '\n> 重要觀念摘錄或反思\n'
                      )
                    }
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 italic text-[11px]"
                  >
                    引言
                  </button>
                </div>

                <Textarea
                  rows={4}
                  value={newReflectionContent}
                  onChange={(e) => setNewReflectionContent(e.target.value)}
                  placeholder="記錄此時此刻的學習心得、對燁輝專案或億威內部落地的想法、待解疑難問題..."
                  className="text-xs font-mono leading-relaxed bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                  autoFocus
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    支援 Markdown 格式，儲存後會記錄在您的個人學習歷程中。
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingReflection(false)}
                      className="h-7 text-xs text-slate-500"
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddReflection}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 font-semibold shadow-sm"
                    >
                      <Save className="h-3 w-3" />
                      <span>儲存這筆札記</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 札記時間軸展示區 (收合時完全隱藏，不留單則) */}
            {reflections.length === 0 ? (
              isAddingReflection ? null : (
                <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-600 font-medium">尚無研習歷程與心得札記</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    線上研習跨越不同時間點，點擊上方「記錄新想法」記錄您在不同階段的心得與思考！
                  </p>
                </div>
              )
            ) : isReflectionsExpanded ? (
              <div className="space-y-2.5">
                {reflections.map((ref) => {
                  const isEditingThis = editingReflectionId === ref.id;

                  if (isEditingThis) {
                    return (
                      <div
                        key={ref.id}
                        className="border border-indigo-300 rounded-xl p-3.5 bg-white space-y-3 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="font-mono">{ref.createdAt}</span>
                            <span className="text-[10px] text-indigo-600 font-medium">
                              (編輯中)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Tag className="h-3 w-3 text-slate-400" />
                            <span className="text-slate-500 font-medium">關聯單元:</span>
                            <select
                              value={editingUnit}
                              onChange={(e) => setEditingUnit(e.target.value)}
                              className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 max-w-[200px]"
                            >
                              <option value="">(無特定 / 綜合想法)</option>
                              {availableUnitOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Markdown 快捷工具列 */}
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                          <span className="text-[10px] text-slate-400 mr-1">快捷工具:</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContent((prev) => prev + '\n### 💡 重點領悟\n')
                            }
                            className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono text-[11px]"
                          >
                            H3標題
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContent((prev) => prev + '**重要觀念** ')
                            }
                            className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 font-bold text-[11px]"
                          >
                            粗體
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContent(
                                (prev) => prev + '\n- 啟發點一\n- 啟發點二\n'
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px]"
                          >
                            條列
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContent(
                                (prev) => prev + '\n> 重要觀念摘錄或反思\n'
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 italic text-[11px]"
                          >
                            引言
                          </button>
                        </div>

                        <Textarea
                          rows={4}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="text-xs font-mono leading-relaxed bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                        />

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEditReflection}
                            className="h-7 text-xs text-slate-500"
                          >
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveEditReflection(ref.id)}
                            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 font-semibold"
                          >
                            <Save className="h-3 w-3" />
                            <span>儲存修訂</span>
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={ref.id}
                      className="border border-slate-200/90 rounded-xl p-3.5 bg-white shadow-sm hover:border-slate-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 text-slate-500 font-medium">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="font-mono text-slate-600 font-semibold">
                              {ref.createdAt}
                            </span>
                          </div>
                          {ref.relatedUnit && (
                            <Badge
                              variant="secondary"
                              className="text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70 gap-1 font-normal py-0"
                            >
                              <Tag className="h-2.5 w-2.5 text-indigo-500" />
                              <span>{ref.relatedUnit}</span>
                            </Badge>
                          )}
                          {ref.updatedAt && (
                            <span className="text-[10px] text-slate-400 italic">
                              (已於 {ref.updatedAt} 修訂)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEditReflection(ref)}
                            className="h-6 px-1.5 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="編輯此則札記"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('確定要刪除這筆心得札記嗎？')) {
                                handleDeleteReflection(ref.id);
                              }
                            }}
                            className="h-6 px-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="刪除此則札記"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs leading-relaxed text-slate-700">
                        <MarkdownPreview content={ref.content} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFiles}
                  className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 font-semibold"
                  title="從電腦上傳成果檔案至 Google 雲端硬碟專案-Map 資料夾"
                >
                  {isUploadingFiles ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span>上傳中...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3 w-3 text-blue-600" />
                      <span>📁 電腦資料 → 直接上傳</span>
                    </>
                  )}
                </Button>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* 上傳進度條展示 */}
            {uploadProgressInfo && (
              <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-300 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 min-w-0">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
                    <span className="truncate">
                      上傳進度 ({uploadProgressInfo.index}/{uploadProgressInfo.total}):{' '}
                      <span className="font-normal text-slate-700">
                        {uploadProgressInfo.currentFileName}
                      </span>
                    </span>
                  </div>
                  <span className="font-bold text-amber-700 shrink-0 ml-2">{uploadProgressInfo.percent}%</span>
                </div>
                <Progress value={uploadProgressInfo.percent} className="h-2 bg-amber-100" />
                <div className="text-[11px] text-amber-800">{uploadProgressInfo.stageMessage}</div>
              </div>
            )}

            {/* 新增連結表單 */}
            {isAddingLink && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-blue-900">
                    新增雲端教材、重點簡報或成果連結：
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFiles}
                    className="h-7 text-xs bg-white hover:bg-blue-100 text-blue-700 border-blue-300 font-semibold gap-1.5 shadow-2xs"
                  >
                    {isUploadingFiles ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        <span>上傳中...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
                        <span>📁 電腦資料 → 直接上傳</span>
                      </>
                    )}
                  </Button>
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

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <a
                        href={(() => {
                          const url = att?.url || '';
                          const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                          if (fileIdMatch && fileIdMatch[1]) {
                            return `https://drive.google.com/uc?id=${fileIdMatch[1]}&export=download`;
                          }
                          const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                          if (idMatch && idMatch[1]) {
                            return `https://drive.google.com/uc?id=${idMatch[1]}&export=download`;
                          }
                          return url || '#';
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="下載檔案"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        title="移除此連結"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
