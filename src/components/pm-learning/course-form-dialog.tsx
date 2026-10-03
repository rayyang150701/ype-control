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

  // 課程檢核清單 (兩階架構：大單元 / 子單元)
  const [chapters, setChapters] = useState<PMLearningChapterUnit[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newSubUnitTexts, setNewSubUnitTexts] = useState<Record<number, string>>({});
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');

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

      // 文章擴充
      setArticleContent(courseToEdit.content || '');
      setArticleSource(courseToEdit.source || courseToEdit.instructorOrPlatform || '');
      setArticleSubSource(courseToEdit.subSource || '');
      setArticleIssueDate(courseToEdit.issueDate || '');
      setTimelinessType(courseToEdit.timelinessType || 'evergreen');

      // 影音與閱讀
      setVideoTimestampNotes(courseToEdit.videoTimestampNotes || '');
      setBookQuotesAndReflections(courseToEdit.bookQuotesAndReflections || '');

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
    }
  }, [courseToEdit?.id, isOpen]);

  const handleToggleMember = (uid: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // 大單元 / 子單元管理操作
  const handleAddChapter = (titleOverride?: string) => {
    const defaultName = `單元 ${chapters.length + 1}`;
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
        defaultChecklist: contentType === 'course' ? chapters : [],

        // 知識文章與其他型態欄位
        content: articleContent.trim(),
        source: articleSource.trim() || effectiveInstructorOrPlatform,
        subSource: articleSubSource.trim(),
        issueDate: articleIssueDate.trim(),
        timelinessType,
        videoTimestampNotes: videoTimestampNotes.trim(),
        bookQuotesAndReflections: bookQuotesAndReflections.trim(),
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
          initialChecklist: contentType === 'course' ? chapters : [],
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

              {/* 文章專屬：專欄子主題 / 單元標籤 (例如：曼報Pro -> 科技曼讀) */}
              {contentType === 'article' && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1 text-slate-700">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      專欄子主題 / 單元標籤 (選填，便於主題分類)
                    </Label>
                    <span className="text-[10px] text-slate-400">如：科技曼讀、巨人之聲</span>
                  </div>
                  <Input
                    value={articleSubSource}
                    onChange={(e) => setArticleSubSource(e.target.value)}
                    placeholder="例如：科技曼讀、巨人之聲、商業解碼..."
                    className="h-9 text-xs"
                  />
                  {/* 曼報 Pro 智慧快捷推薦按鈕 */}
                  {(articleSource.includes('曼報') || !articleSource) && (
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
              )}
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

          {/* 文章專屬：出刊年月 (YYYY-MM) 與時效性質 */}
          {contentType === 'article' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1 text-emerald-950">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  發布日期 (年月日)
                </Label>
                <Input
                  type="date"
                  value={articleIssueDate}
                  onChange={(e) => setArticleIssueDate(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1 text-emerald-950">
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
          )}

          {/* 外部連結 (文章原文網址 / 影音播放連結 / 官方課程教室 / Google 雲端硬碟) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
              {contentType === 'article'
                ? '原文網頁出處 (選填，保留可連結回付費專欄)'
                : contentType === 'video'
                ? '影音觀看外部連結 (YouTube / Webinar / Podcast)'
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

          {/* 文章專屬：完整內文編輯器 (Markdown) */}
          {contentType === 'article' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  文章完整內容 (直接貼入內文，支援 Markdown、程式碼與圖片語法)
                </Label>
                <span className="text-[11px] text-slate-400">
                  可使用 `![說明](圖片網址)` 嵌入圖片
                </span>
              </div>
              <Textarea
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                placeholder="直接將付費專欄文章貼於此處...&#10;&#10;支援 Markdown 標題 (#, ##)、項目清單 (- )、引用區塊 (> ) 與圖片語法。"
                rows={8}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {/* 影音專屬：重點時戳與筆記 */}
          {contentType === 'video' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-rose-600" />
                重點時間標籤與筆記 (Markdown)
              </Label>
              <Textarea
                value={videoTimestampNotes}
                onChange={(e) => setVideoTimestampNotes(e.target.value)}
                placeholder="例如：&#10;- **02:15** Modbus TCP 通訊輪詢重點&#10;- **08:30** OPC UA 端點配置&#10;- **15:00** 現場除錯常見問題"
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* 個人閱讀專屬：核心金句與落地行動清單 */}
          {contentType === 'book' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Bookmark className="h-3.5 w-3.5 text-amber-600" />
                核心金句、反思與實務落地行動清單 (Action Plan)
              </Label>
              <Textarea
                value={bookQuotesAndReflections}
                onChange={(e) => setBookQuotesAndReflections(e.target.value)}
                placeholder="例如：&#10;### 核心金句&#10;> 「最有害的領導不是殘酷無情，而是表面和諧。」&#10;&#10;### 專案落地行動&#10;1. 建立開誠布公的卡關複盤機制&#10;2. 每週事前溝通關鍵風險"
                rows={5}
                className="font-mono text-xs"
              />
            </div>
          )}

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

          {/* 線上課程專屬：兩階章節單元檢核清單 (大單元 / 子單元) */}
          {contentType === 'course' && (
            <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <Label className="text-xs font-bold text-slate-800">
                    課程章節單元清單 (兩階架構：大單元 / 子單元)
                  </Label>
                  {chapters.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-white text-indigo-700 border-indigo-200 font-medium"
                    >
                      {chapters.length} 個大單元 · 共{' '}
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
                  <span>{isBatchImportOpen ? '收合批次貼上' : '📋 快捷批次貼上'}</span>
                </Button>
              </div>

              {/* 快捷批次貼上解析區塊 */}
              {isBatchImportOpen && (
                <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-indigo-900 font-semibold">
                    <span>直接貼上多行單元文字 (自動識別兩階單元1. / 1.1 / 1.2 等)：</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBatchImportText(
                          '單元1.\n1.1 需求訪談與定義\n1.2 範疇基準建立\n單元2\n2.1 現場施工調校\n2.2 驗收測試與簽核'
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
                    placeholder="單元1.&#10;1.1 需求訪談與定義&#10;1.2 範疇基準建立&#10;單元2&#10;2.1 現場施工調校&#10;2.2 驗收測試與簽核"
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
                      解析並加入單元
                    </Button>
                  </div>
                </div>
              )}

              {/* 兩階章節單元呈現列表 */}
              {chapters.length === 0 ? (
                <div className="text-center py-6 px-4 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 space-y-1.5">
                  <Layers className="h-6 w-6 mx-auto text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">尚無課程單元</p>
                  <p className="text-[11px] text-slate-400">
                    請點選下方「新增大單元 (章節)」或使用上方「快捷批次貼上」建立課程單元。
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {chapters.map((chap, cIdx) => (
                    <div
                      key={chap.id || `chap-${cIdx}`}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-3 transition-colors hover:border-indigo-200"
                    >
                      {/* 第一階：大單元標題與操作 */}
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
                            大單元 {cIdx + 1}
                          </span>
                          <Input
                            value={chap.title}
                            onChange={(e) => handleUpdateChapterTitle(cIdx, e.target.value)}
                            placeholder={`例如：單元 ${cIdx + 1}`}
                            className="h-7 text-xs font-bold text-slate-800 bg-transparent border-slate-200 focus:bg-white"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {chap.subUnits.length} 個子單元
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveChapter(cIdx)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="刪除此大單元及其所有子單元"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

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
                              placeholder={`輸入子單元名稱 (例如：${cIdx + 1}.${chap.subUnits.length + 1} ...)`}
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

              {/* 底部：新增大單元輸入行 */}
              <div className="flex gap-2 pt-1 border-t border-slate-200">
                <Input
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder={`輸入新大單元名稱 (例如：單元 ${chapters.length + 1})...`}
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
                  新增大單元 (章節)
                </Button>
              </div>
            </div>
          )}

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
