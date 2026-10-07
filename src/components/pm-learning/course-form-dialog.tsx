'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  BookOpen,
  ExternalLink,
  Calendar,
  Users,
  Layers,
  Settings,
  Tag,
  Clock,
  FileText,
  Video,
  Bookmark,
  Sparkles,
  Zap,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  Pin,
} from 'lucide-react';
import {
  PMLearningCourse,
  PMLearningContentType,
  PMLearningTimelinessType,
  DEFAULT_PM_CATEGORIES,
  CONTENT_TYPE_CONFIG,
  PMLearningChapterUnit,
} from '@/types/pm-learning';
import { User } from '@/types';
import {
  createPMLearningCourse,
  updatePMLearningCourse,
  savePMLearningCategories,
} from '@/lib/pm-learning-actions';
import {
  normalizeChecklistToChapters,
  parseTextToChecklistChapters,
} from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';

interface CourseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pmoMembers: User[];
  courseToEdit?: PMLearningCourse | null;
  onSuccess: (course: PMLearningCourse) => void;
  currentUserId?: string;
  defaultAssignedUserId?: string;
  availableCategories?: string[];
  onOpenCategoryManager?: () => void;
  initialType?: PMLearningContentType;
}

export function CourseFormDialog({
  isOpen,
  onClose,
  pmoMembers,
  courseToEdit,
  onSuccess,
  currentUserId,
  defaultAssignedUserId,
  availableCategories = DEFAULT_PM_CATEGORIES,
  onOpenCategoryManager,
  initialType = 'course',
}: CourseFormDialogProps) {
  if (!isOpen) return null;

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 四大載體型態選擇
  const [contentType, setContentType] = useState<PMLearningContentType>(initialType);

  // 基本通用欄位
  const [title, setTitle] = useState('');
  const [instructorOrPlatform, setInstructorOrPlatform] = useState('');
  const [category, setCategory] = useState(availableCategories[0] || '專案管理與治理');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [hours, setHours] = useState<number>(16);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);

  // 知識文章 (Article) 專屬欄位
  const [articleContent, setArticleContent] = useState('');
  const [articleSource, setArticleSource] = useState('');
  const [articleSubSource, setArticleSubSource] = useState('');
  const [articleIssueDate, setArticleIssueDate] = useState('');
  const [timelinessType, setTimelinessType] = useState<PMLearningTimelinessType>('evergreen');

  // 影音 (Video) 專屬欄位
  const [videoTimestampNotes, setVideoTimestampNotes] = useState('');

  // 個人閱讀 (Book) 專屬欄位
  const [bookQuotesAndReflections, setBookQuotesAndReflections] = useState('');

  // 課程檢核清單 (兩階架構：大單元 / 子單元，或系列專題篇目)
  const [chapters, setChapters] = useState<PMLearningChapterUnit[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newSubUnitTexts, setNewSubUnitTexts] = useState<Record<number, string>>({});
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');
  const [openChapterContentIdxs, setOpenChapterContentIdxs] = useState<Record<number, boolean>>({});

  // 大單元展開/縮回狀態 (預設全開)
  const [expandedDialogChapters, setExpandedDialogChapters] = useState<Record<number, boolean>>({});

  const isDialogChapterExpanded = (idx: number) => {
    return expandedDialogChapters[idx] !== false;
  };

  const handleToggleDialogChapter = (idx: number) => {
    setExpandedDialogChapters((prev) => ({
      ...prev,
      [idx]: prev[idx] === false ? true : false,
    }));
  };

  const handleToggleChapterContentOpen = (chapterIdx: number) => {
    setOpenChapterContentIdxs((prev) => ({
      ...prev,
      [chapterIdx]: !prev[chapterIdx],
    }));
  };

  // 整理所有可用領域
  const categoryOptions = React.useMemo(() => {
    const set = new Set([...availableCategories]);
    if (category && category !== '__CUSTOM__') {
      set.add(category);
    }
    return Array.from(set);
  }, [availableCategories, category]);

  // 初始化欄位
  useEffect(() => {
    if (courseToEdit) {
      setContentType(courseToEdit.type || 'course');
      setTitle(courseToEdit.title);
      setInstructorOrPlatform(courseToEdit.instructorOrPlatform);
      const existingCat = courseToEdit.category || availableCategories[0] || '專案管理與治理';
      setCategory(existingCat);
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setExternalUrl(courseToEdit.externalUrl || '');
      setHours(courseToEdit.hours !== undefined ? Number(courseToEdit.hours) : 16);
      setStartDate(courseToEdit.startDate || '');
      setEndDate(courseToEdit.endDate || '');
      setDescription(courseToEdit.description || '');
      setAssignedUserIds(courseToEdit.assignedUserIds || []);
      setIsPinned(Boolean(courseToEdit.isPinned));

      // 統一重點內容 (支援所有載體)
      const unifiedContent =
        courseToEdit.content ||
        courseToEdit.bookQuotesAndReflections ||
        courseToEdit.videoTimestampNotes ||
        '';
      setArticleContent(unifiedContent);
      setArticleSource(courseToEdit.source || courseToEdit.instructorOrPlatform || '');
      setArticleSubSource(courseToEdit.subSource || '');
      setArticleIssueDate(courseToEdit.issueDate || '');
      setTimelinessType(courseToEdit.timelinessType || 'evergreen');

      // 影音與閱讀相容
      setVideoTimestampNotes(courseToEdit.videoTimestampNotes || unifiedContent);
      setBookQuotesAndReflections(courseToEdit.bookQuotesAndReflections || unifiedContent);

      const existingList = Array.isArray(courseToEdit.defaultChecklist)
        ? courseToEdit.defaultChecklist
        : [];
      setChapters(normalizeChecklistToChapters(existingList));
    } else {
      setContentType(initialType);
      setTitle('');
      setInstructorOrPlatform('');
      setCategory(availableCategories[0] || '專案管理與治理');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setExternalUrl('');

      const today = new Date();
      const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setArticleIssueDate(currentDate);
      setTimelinessType('evergreen');
      setArticleContent('');
      setArticleSource('');
      setArticleSubSource('');
      setVideoTimestampNotes('');
      setBookQuotesAndReflections('');

      const todayStr = today.toISOString().slice(0, 10);
      setStartDate(todayStr);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setEndDate(nextMonth.toISOString().slice(0, 10));
      setDescription('');

      if (initialType === 'article') {
        setHours(0.5);
      } else if (initialType === 'video') {
        setHours(0.5);
      } else if (initialType === 'book') {
        setHours(2);
      } else {
        setHours(16);
      }

      // 預設指派成員
      if (defaultAssignedUserId) {
        setAssignedUserIds([defaultAssignedUserId]);
      } else {
        setAssignedUserIds((pmoMembers || []).map((m) => m.uid));
      }

      // 使用者需求 1：新增課程時候，不需要預設這些單元，由使用者自行新增更新
      setChapters([]);
      setIsPinned(false);
    }
  }, [courseToEdit?.id, isOpen]);

  const handleToggleMember = (uid: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // 大單元 / 系列篇目 / 子單元管理操作
  const handleAddChapter = (titleOverride?: string) => {
    const defaultName =
      contentType === 'article'
        ? `第 ${chapters.length + 1} 篇`
        : contentType === 'book'
        ? `第 ${chapters.length + 1} 章`
        : `單元 ${chapters.length + 1}`;
    const titleToUse =
      (titleOverride !== undefined ? titleOverride : newChapterTitle).trim() || defaultName;
    const newChap: PMLearningChapterUnit = {
      id: `chap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: titleToUse,
      subUnits: [],
    };
    setChapters((prev) => [...prev, newChap]);
    setNewChapterTitle('');
  };

  const handleRemoveChapter = (chapterIdx: number) => {
    setChapters((prev) => prev.filter((_, idx) => idx !== chapterIdx));
  };

  const handleUpdateChapterTitle = (chapterIdx: number, title: string) => {
    setChapters((prev) =>
      prev.map((c, idx) => (idx === chapterIdx ? { ...c, title } : c))
    );
  };

  const handleUpdateChapterContent = (chapterIdx: number, content: string) => {
    setChapters((prev) =>
      prev.map((c, idx) => (idx === chapterIdx ? { ...c, content } : c))
    );
  };

  const handleUpdateChapterUrl = (chapterIdx: number, url: string) => {
    setChapters((prev) =>
      prev.map((c, idx) => (idx === chapterIdx ? { ...c, url } : c))
    );
  };

  const handleAddSubUnit = (chapterIdx: number, subTextOverride?: string) => {
    const rawText = (
      subTextOverride !== undefined ? subTextOverride : newSubUnitTexts[chapterIdx] || ''
    ).trim();
    if (!rawText) return;

    setChapters((prev) =>
      prev.map((c, idx) => {
        if (idx !== chapterIdx) return c;
        return {
          ...c,
          subUnits: [...c.subUnits, rawText],
        };
      })
    );

    setNewSubUnitTexts((prev) => ({ ...prev, [chapterIdx]: '' }));
  };

  const handleRemoveSubUnit = (chapterIdx: number, subIdx: number) => {
    setChapters((prev) =>
      prev.map((c, idx) => {
        if (idx !== chapterIdx) return c;
        return {
          ...c,
          subUnits: c.subUnits.filter((_, sIdx) => sIdx !== subIdx),
        };
      })
    );
  };

  const handleUpdateSubUnit = (chapterIdx: number, subIdx: number, newTitle: string) => {
    setChapters((prev) =>
      prev.map((c, idx) => {
        if (idx !== chapterIdx) return c;
        const newSubs = [...c.subUnits];
        newSubs[subIdx] = newTitle;
        return {
          ...c,
          subUnits: newSubs,
        };
      })
    );
  };

  // 批次貼上解析匯入
  const handleApplyBatchImport = () => {
    if (!batchImportText.trim()) return;
    const parsed = parseTextToChecklistChapters(batchImportText);
    if (parsed.length === 0) {
      toast({
        title: '無法辨識章節內容',
        description: '請確認貼上的文字格式是否包含單元或子單元編號',
        variant: 'destructive',
      });
      return;
    }
    setChapters((prev) => [...prev, ...parsed]);
    setBatchImportText('');
    setIsBatchImportOpen(false);
    toast({
      title: '批次匯入完成',
      description: `已成功匯入 ${parsed.length} 個大單元與對應子單元`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: '請填寫標題', variant: 'destructive' });
      return;
    }

    const finalCategory = isCustomCategory
      ? customCategoryInput.trim() || '其他領域'
      : category.trim() || '專案管理與治理';

    const effectiveInstructorOrPlatform =
      contentType === 'article'
        ? articleSource.trim() || instructorOrPlatform.trim() || '付費知識專欄'
        : instructorOrPlatform.trim() || '內部研習';

    if (assignedUserIds.length === 0) {
      toast({ title: '請至少指派一位研讀成員', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isCustomCategory && customCategoryInput.trim()) {
        const newCat = customCategoryInput.trim();
        if (!availableCategories.includes(newCat)) {
          savePMLearningCategories([...availableCategories, newCat]);
        }
      }

      const assignedNames = assignedUserIds.map((uid) => {
        const found = (pmoMembers || []).find((m) => m.uid === uid);
        return found?.displayName || found?.email || '成員';
      });

      const payload = {
        type: contentType,
        title: title.trim(),
        instructorOrPlatform: effectiveInstructorOrPlatform,
        category: finalCategory,
        externalUrl: externalUrl.trim(),
        hours: Math.max(0, Number(hours) || 0),
        startDate,
        endDate,
        description: description.trim(),
        assignedUserIds,
        assignedUserNames: assignedNames,
        defaultChecklist: chapters.length > 0 ? chapters : [],
        isPinned,

        // 四大載體統一重點內容與向前相容
        content: articleContent.trim(),
        source: (contentType === 'article' ? articleSource.trim() : '') || effectiveInstructorOrPlatform,
        subSource: articleSubSource.trim(),
        issueDate: articleIssueDate.trim(),
        timelinessType,
        videoTimestampNotes:
          contentType === 'video'
            ? articleContent.trim() || videoTimestampNotes.trim()
            : videoTimestampNotes.trim(),
        bookQuotesAndReflections:
          contentType === 'book'
            ? articleContent.trim() || bookQuotesAndReflections.trim()
            : bookQuotesAndReflections.trim(),
      };

      if (courseToEdit) {
        const res = await updatePMLearningCourse(courseToEdit.id, payload);

        if (res.success && res.data) {
          onClose();
          onSuccess(res.data);
          toast({ title: '更新成功', description: `已更新「${title}」` });
        } else {
          toast({ title: '更新失敗', description: res.message, variant: 'destructive' });
        }
      } else {
        const res = await createPMLearningCourse({
          ...payload,
          initialChecklist: chapters.length > 0 ? chapters : [],
          createdBy: currentUserId || defaultAssignedUserId || 'user',
        });

        if (res.success && res.data) {
          onClose();
          onSuccess(res.data);
          toast({ title: '建立成功', description: `已新增「${title}」並指派成員` });
        } else {
          toast({ title: '建立失敗', description: res.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: '操作發生錯誤', description: err?.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold">
                {courseToEdit ? '編輯 PM 成長項目' : '新增 PM 成長項目與指派'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                支援線上課程、時效付費文章（可存全文）、影音資源與個人閱讀心得。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 載體型態選擇器 (Segmented Tabs) */}
        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
          {(['course', 'article', 'video', 'book'] as PMLearningContentType[]).map((type) => {
            const cfg = CONTENT_TYPE_CONFIG[type];
            const isSelected = contentType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </div>
                <span className="text-[10px] font-normal text-slate-400 scale-90 truncate max-w-full">
                  {type === 'article'
                    ? '存全文 / AI 導讀'
                    : type === 'video'
                    ? '影音連結 / 時戳'
                    : type === 'book'
                    ? '反思 / 行動清單'
                    : '章節檢核 / 時數'}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 標題 (根據型態調整 Label) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              {contentType === 'article'
                ? '文章標題'
                : contentType === 'video'
                ? '影音名稱'
                : contentType === 'book'
                ? '書籍 / 專案報告名稱'
                : '課程名稱'}{' '}
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                contentType === 'article'
                  ? '例如：生成式 AI 在製造業製程排程之落地實例'
                  : contentType === 'video'
                  ? '例如：工業物聯網現場通訊實務：Modbus TCP 與 OPC UA 整合'
                  : contentType === 'book'
                  ? '例如：《徹底坦率：一種有話直說的領導風格》PM 溝通反思'
                  : '例如：智慧製造專案管理與四大階段變更控制實務'
              }
              required
            />
          </div>

          {/* 來源 / 講師 / 平台 與 領域分類 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                {contentType === 'article'
                  ? '專欄來源 / 出版媒體'
                  : contentType === 'video'
                  ? '頻道 / 講者 / 平台'
                  : contentType === 'book'
                  ? '作者 / 出版社'
                  : '講師 / 培訓平台'}{' '}
                <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={contentType === 'article' ? articleSource : instructorOrPlatform}
                onChange={(e) => {
                  if (contentType === 'article') {
                    setArticleSource(e.target.value);
                  }
                  setInstructorOrPlatform(e.target.value);
                }}
                placeholder={
                  contentType === 'article'
                    ? '例如：曼報Pro、數位時代付費專欄、商業周刊'
                    : contentType === 'video'
                    ? '例如：YouTube 工控技術頻道、Webinar、Podcast'
                    : contentType === 'book'
                    ? '例如：天下文化、商業周刊精選、天下雜誌'
                    : '例如：工研院產業學院、Hahow、PMI'
                }
                required
              />

              {/* 專欄子主題 / 單元標籤 (適用所有型態) */}
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1 text-slate-700">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    {contentType === 'article'
                      ? '專欄子主題 / 單元標籤 (選填，便於主題分類)'
                      : contentType === 'book'
                      ? '書籍系列 / 專題標籤 (選填)'
                      : contentType === 'video'
                      ? '頻道專題 / 單元系列 (選填)'
                      : '模組系列 / 專案課程標籤 (選填)'}
                  </Label>
                  <span className="text-[10px] text-slate-400">
                    {contentType === 'article'
                      ? '如：科技曼讀、巨人之聲'
                      : contentType === 'book'
                      ? '如：大師經典、商業投資'
                      : '如：案例解析、技術實戰'}
                  </span>
                </div>
                <Input
                  value={articleSubSource}
                  onChange={(e) => setArticleSubSource(e.target.value)}
                  placeholder={
                    contentType === 'article'
                      ? '例如：科技曼讀、巨人之聲、商業解碼...'
                      : contentType === 'book'
                      ? '例如：經典導讀、操盤實戰、管理思維...'
                      : '例如：工控實戰、案例解析...'
                  }
                  className="h-9 text-xs"
                />
                {/* 曼報 Pro 智慧快捷推薦按鈕 */}
                {contentType === 'article' && (articleSource.includes('曼報') || !articleSource) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">曼報快捷:</span>
                    {['科技曼讀', '巨人之聲', '商業解碼'].map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setArticleSubSource(sub);
                          if (!articleSource) setArticleSource('曼報Pro');
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                          articleSubSource === sub
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 學習領域類別 (支援選單、自訂與管理) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-indigo-600" />
                  學習領域標籤
                </Label>
                {onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Settings className="h-3 w-3" />
                    <span>維護領域類別</span>
                  </button>
                )}
              </div>

              {!isCustomCategory ? (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomCategory(true);
                      setCustomCategoryInput('');
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__CUSTOM__">➕ 自訂新領域標籤...</option>
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <Input
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="輸入新領域名稱，例如：工廠通訊與資安"
                    className="h-10 text-xs flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setCategory(categoryOptions[0] || '專案管理與治理');
                    }}
                    className="h-10 text-xs shrink-0"
                  >
                    選單選擇
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 發布日期 (出刊/出版/發布) 與時效性質 (四大載體統一支援) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1 text-slate-800">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                {contentType === 'article'
                  ? '出刊/發布日期 (年月日)'
                  : contentType === 'book'
                  ? '出版/發行日期 (年月日)'
                  : contentType === 'video'
                  ? '影音發布日期 (年月日)'
                  : '開課/發布日期 (年月日)'}
              </Label>
              <Input
                type="date"
                value={articleIssueDate}
                onChange={(e) => setArticleIssueDate(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1 text-slate-800">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                時效性質判定
              </Label>
              <select
                value={timelinessType}
                onChange={(e) => setTimelinessType(e.target.value as PMLearningTimelinessType)}
                className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm font-medium"
              >
                <option value="evergreen">🌱 常青知識 (長期適用、通用心法)</option>
                <option value="time_sensitive">⚡ 時效趨勢 (付費月刊、近期關鍵評估)</option>
              </select>
            </div>
          </div>

          {/* 外部連結 (文章原文網址 / 影音播放連結 / 官方課程教室 / Google 雲端硬碟) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
              {contentType === 'article'
                ? '原文網頁出處 (選填，保留可連結回付費專欄)'
                : contentType === 'video'
                ? '影音觀看外部連結 (YouTube / Webinar / Podcast)'
                : contentType === 'book'
                ? '書籍介紹或電子書傳送門 (選填)'
                : '外部傳送門連結 (線上教室 / 官方教材 / Google 雲端硬碟)'}
            </Label>
            <Input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="例如：https://drive.google.com/... 或 https://..."
            />
            {externalUrl.includes('drive.google.com') && (
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span>📁</span>
                <span>已設定為 Google 雲端硬碟！提醒：請確保該資料夾或檔案已開啟「知道連結的使用者皆可查看」共用權限。</span>
              </p>
            )}
          </div>

          {/* 四大載體統一：重點內容 / 內文 / 講義大綱 / 讀書筆記編輯區塊 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1">
                {contentType === 'article' ? (
                  <>
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span>文章完整內容與核心重點 (Markdown)</span>
                  </>
                ) : contentType === 'book' ? (
                  <>
                    <Bookmark className="h-3.5 w-3.5 text-amber-600" />
                    <span>書籍核心重點、精華摘錄與行動清單 (Markdown)</span>
                  </>
                ) : contentType === 'video' ? (
                  <>
                    <Video className="h-3.5 w-3.5 text-rose-600" />
                    <span>影音重點精華、時間標籤與筆記 (Markdown)</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                    <span>課程核心講義、大綱與研習重點 (Markdown)</span>
                  </>
                )}
              </Label>
              <span className="text-[11px] text-slate-400">
                支援 Markdown 語法，系統將依此內容提供 AI 導讀與即時問答
              </span>
            </div>
            <Textarea
              value={articleContent}
              onChange={(e) => {
                const val = e.target.value;
                setArticleContent(val);
                if (contentType === 'video') setVideoTimestampNotes(val);
                if (contentType === 'book') setBookQuotesAndReflections(val);
              }}
              placeholder={
                contentType === 'article'
                  ? '直接將付費專欄或文章內文貼於此處...&#10;&#10;支援 Markdown 標題 (#, ##)、項目清單 (- )、引用區塊 (> ) 與圖片語法。'
                  : contentType === 'book'
                  ? '貼入書籍核心觀點、各章重點摘錄或實務落地反思...&#10;&#10;例如：&#10;### 核心觀點&#10;> 「投資關鍵在於因子的長期超額報酬與風險控管。」&#10;&#10;### 落地行動清單&#10;1. 建立量化指標篩選機制&#10;2. 每季檢視因子有效性'
                  : contentType === 'video'
                  ? '貼入影音重點精華、逐字稿筆記或時間戳記...&#10;&#10;例如：&#10;- **02:15** Modbus TCP 通訊輪詢重點&#10;- **08:30** OPC UA 端點配置&#10;- **15:00** 現場除錯常見問題'
                  : '將線上課程的核心講義、重點單元大綱或研習筆記貼於此處...&#10;&#10;支援 Markdown 標題 (#, ##)、項目清單 (- )、引用區塊 (> )。系統可針對此內容執行 AI 導讀與深入問答。'
              }
              rows={8}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* 研習時數與預計起訖日 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                {contentType === 'article' || contentType === 'video'
                  ? '預估閱讀/觀看時間 (小時)'
                  : '研習/培訓時數 (小時)'}
              </Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                placeholder="例如：0.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                預計開始日
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                預計完成日 (期限)
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* 簡短說明 / 核心目標 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              內容說明與核心目標導讀 (選填)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="簡要描述此資源的核心重點，供指派成員快速瞭解研習目的..."
              rows={2}
              className="text-xs"
            />
          </div>

          {/* 兩階章節單元 / 系列專題篇目檢核清單 (四大載體皆全面支援，特別針對多篇系列文章設計) */}
          <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Layers className="h-4 w-4 text-indigo-600" />
                <Label className="text-xs font-bold text-slate-800">
                  {contentType === 'article'
                    ? '📚 系列專題篇目 / 章節結構 (選填，多篇探討系列可在此建立篇目，依序研讀與控管進度)'
                    : contentType === 'book'
                    ? '📖 書籍章節單元清單 (兩階架構：大章節 / 子節)'
                    : contentType === 'video'
                    ? '🎥 影音章節 / 探討段落清單'
                    : '🎓 課程章節單元清單 (兩階架構：大單元 / 子單元)'}
                </Label>
                {chapters.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white text-indigo-700 border-indigo-200 font-medium"
                  >
                    {chapters.length} 個{contentType === 'article' ? '篇目' : '大單元'} · 共{' '}
                    {chapters.reduce((sum, c) => sum + (c.subUnits?.length || 0), 0)} 個子單元
                  </Badge>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBatchImportOpen(!isBatchImportOpen)}
                className="h-7 text-xs px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium gap-1"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>{isBatchImportOpen ? '收合批次貼上' : '📋 快捷批次貼上篇目'}</span>
              </Button>
            </div>

            {contentType === 'article' && (
              <p className="text-[11px] text-slate-500 leading-relaxed bg-white/70 p-2 rounded-lg border border-slate-200/60">
                💡 <b>多篇探討系列文章最佳實踐</b>：若同一個主題探討包含多篇（例如：第一篇、第二篇、第三篇、第四篇），可在此建立各篇篇目。
                對外僅呈現單一文章卡片（不佔版面），對內可依序閱讀並逐篇打勾控管進度，亦可為各篇填寫專屬內文或連結！
              </p>
            )}

            {/* 快捷批次貼上解析區塊 */}
            {isBatchImportOpen && (
              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-indigo-900 font-semibold">
                  <span>
                    {contentType === 'article'
                      ? '直接貼上各篇篇目標題（一行一篇，自動識別「第一篇：...」、「第二篇：...」等）：'
                      : '直接貼上多行單元文字 (自動識別兩階單元1. / 1.1 / 1.2 等)：'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBatchImportText(
                        contentType === 'article'
                          ? '第一篇：別人出錢出力的高利潤生意\n第二篇：學術出版業為何越來越集中化？\n第三篇：學術聲望與出版量如何兼得？\n第四篇：再投資機會有限的「中等」生意——Springer Nature'
                          : '單元1.\n1.1 需求訪談與定義\n1.2 範疇基準建立\n單元2\n2.1 現場施工調校\n2.2 驗收測試與簽核'
                      )
                    }
                    className="text-[10px] text-indigo-600 hover:underline font-normal"
                  >
                    帶入範例格式
                  </button>
                </div>
                <Textarea
                  value={batchImportText}
                  onChange={(e) => setBatchImportText(e.target.value)}
                  placeholder={
                    contentType === 'article'
                      ? '第一篇：別人出錢出力的高利潤生意\n第二篇：學術出版業為何越來越集中化？\n第三篇：學術聲望與出版量如何兼得？\n第四篇：再投資機會有限的「中等」生意——Springer Nature'
                      : '單元1.\n1.1 需求訪談與定義\n1.2 範疇基準建立\n單元2\n2.1 現場施工調校\n2.2 驗收測試與簽核'
                  }
                  rows={5}
                  className="font-mono text-xs bg-white"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBatchImportOpen(false)}
                    className="h-7 text-xs text-slate-500"
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyBatchImport}
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    解析並加入篇目
                  </Button>
                </div>
              </div>
            )}

            {/* 兩階章節單元呈現列表 */}
            {chapters.length === 0 ? (
              <div className="text-center py-6 px-4 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 space-y-1.5">
                <Layers className="h-6 w-6 mx-auto text-slate-300" />
                <p className="text-xs font-medium text-slate-600">
                  {contentType === 'article' ? '尚無設定系列篇目 (單篇文章可留空)' : '尚無課程單元'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {contentType === 'article'
                    ? '若本文章為單篇，無須填寫此處；若為同一主題多篇探討，請點選下方「新增篇目」或「快捷批次貼上」。'
                    : '請點選下方「新增大單元 (章節)」或使用上方「快捷批次貼上」建立課程單元。'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {chapters.map((chap, cIdx) => (
                  <div
                    key={chap.id || `chap-${cIdx}`}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-3 transition-colors hover:border-indigo-200"
                  >
                    {/* 第一階：大單元/篇目標題與操作 */}
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDialogChapter(cIdx)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                          title={isDialogChapterExpanded(cIdx) ? '縮回此單元' : '展開此單元'}
                        >
                          {isDialogChapterExpanded(cIdx) ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                          {contentType === 'article' ? `第 ${cIdx + 1} 篇` : `大單元 ${cIdx + 1}`}
                        </span>
                        <Input
                          value={chap.title}
                          onChange={(e) => handleUpdateChapterTitle(cIdx, e.target.value)}
                          placeholder={
                            contentType === 'article'
                              ? `例如：第 ${cIdx + 1} 篇：核心脈絡與商業模式`
                              : `例如：單元 ${cIdx + 1}`
                          }
                          className="h-7 text-xs font-bold text-slate-800 bg-transparent border-slate-200 focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 編輯專屬分篇內文按鈕 */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleChapterContentOpen(cIdx)}
                          className={`h-7 px-2 text-xs font-semibold gap-1 rounded transition-colors ${
                            chap.content || chap.url
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-indigo-600 hover:bg-indigo-50'
                          }`}
                          title="編輯本篇專屬內文 (Markdown) 與獨立原文連結"
                        >
                          <FileText className="h-3 w-3" />
                          <span>{chap.content ? '已填分篇內文' : '填寫分篇內文'}</span>
                        </Button>

                        <span className="text-[10px] text-slate-400 font-medium">
                          {chap.subUnits.length > 0 ? `${chap.subUnits.length} 個子單元` : ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveChapter(cIdx)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="刪除此篇目/大單元"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 專屬分篇內文與連結抽屜 (若展開) */}
                    {openChapterContentIdxs[cIdx] && (
                      <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-200/80 space-y-2 mt-1 animate-in fade-in-50 duration-150">
                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-indigo-600" />
                            第 {cIdx + 1} 篇專屬內文 (Markdown，選填；若已貼於上方主內文此處可留空)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleChapterContentOpen(cIdx)}
                            className="text-slate-400 hover:text-slate-600 text-[10px]"
                          >
                            收合
                          </button>
                        </div>
                        <Textarea
                          value={chap.content || ''}
                          onChange={(e) => handleUpdateChapterContent(cIdx, e.target.value)}
                          placeholder={`貼上第 ${cIdx + 1} 篇的獨立內文 (支援 Markdown)... 研讀時將可直接閱讀此篇專屬內容`}
                          rows={4}
                          className="text-xs bg-white border-indigo-200 focus-visible:ring-indigo-400"
                        />
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <Input
                            value={chap.url || ''}
                            onChange={(e) => handleUpdateChapterUrl(cIdx, e.target.value)}
                            placeholder="本篇專屬原文網址 / 雲端連結 (選填)"
                            className="h-6.5 text-xs bg-white border-indigo-200 flex-1"
                          />
                        </div>
                      </div>
                    )}

                    {/* 第二階：子單元清單 (支援展開/縮回) */}
                    {isDialogChapterExpanded(cIdx) && (
                      <div className="space-y-1.5 pl-3 border-l-2 border-indigo-100 ml-1">
                        {chap.subUnits.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/70 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <Input
                                value={sub}
                                onChange={(e) => handleUpdateSubUnit(cIdx, sIdx, e.target.value)}
                                placeholder="子單元名稱"
                                className="h-6 text-xs bg-white border-slate-200"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubUnit(cIdx, sIdx)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 shrink-0"
                              title="刪除此子單元"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}

                        {/* 新增子單元輸入行 */}
                        <div className="flex gap-1.5 pt-1">
                          <Input
                            value={newSubUnitTexts[cIdx] || ''}
                            onChange={(e) =>
                              setNewSubUnitTexts((prev) => ({
                                ...prev,
                                [cIdx]: e.target.value,
                              }))
                            }
                            placeholder={
                              contentType === 'article'
                                ? `新增此篇子段落 / 探討重點 (選填)...`
                                : `輸入子單元名稱 (例如：${cIdx + 1}.${chap.subUnits.length + 1} ...)`
                            }
                            className="h-7 text-xs bg-slate-50 flex-1 focus:bg-white"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSubUnit(cIdx);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddSubUnit(cIdx)}
                            className="h-7 text-xs shrink-0 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1 px-2.5"
                          >
                            <Plus className="h-3 w-3" />
                            新增子單元
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 底部：新增篇目 / 大單元輸入行 */}
            <div className="flex gap-2 pt-1 border-t border-slate-200">
              <Input
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder={
                  contentType === 'article'
                    ? `輸入新篇目標題 (例如：第 ${chapters.length + 1} 篇：商業模式探討)...`
                    : `輸入新大單元名稱 (例如：單元 ${chapters.length + 1})...`
                }
                className="h-8 text-xs bg-white flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChapter();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddChapter()}
                className="h-8 text-xs shrink-0 text-indigo-700 border-indigo-300 hover:bg-indigo-50 font-bold gap-1 px-3 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {contentType === 'article' ? '新增篇目' : '新增大單元 (章節)'}
              </Button>
            </div>
          </div>

          {/* 置頂設定 (Pin to top) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                <Pin className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                <span>設為置頂項目 (Pin to top)</span>
              </div>
              <p className="text-[11px] text-amber-700/90">
                開啟後，本項目將優先釘選於 PM 學習地圖最頂端，利於重點研讀或首要跟催項目
              </p>
            </div>
            <Switch
              checked={isPinned}
              onCheckedChange={setIsPinned}
            />
          </div>

          {/* 指派受訓 / 研讀成員 */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                指派研讀成員 (億威電子 · PMO 部門) <span className="text-rose-500">*</span>
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignedUserIds((pmoMembers || []).map((m) => m.uid))}
                  className="text-[11px] text-indigo-600 hover:underline"
                >
                  全選
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setAssignedUserIds([])}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-44 overflow-y-auto">
              {(pmoMembers || []).map((member) => {
                const isSelected = (assignedUserIds || []).includes(member.uid);
                return (
                  <div
                    key={member.uid}
                    onClick={() => handleToggleMember(member.uid)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleMember(member.uid)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="truncate">
                      <div className="truncate">{member.displayName || member.username}</div>
                      <div className="text-[10px] text-slate-400 truncate">{member.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isSubmitting ? '儲存中...' : courseToEdit ? '儲存變更' : '建立並指派'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
