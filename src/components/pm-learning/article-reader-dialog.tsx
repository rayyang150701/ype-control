'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Sparkles,
  ExternalLink,
  Calendar,
  Building2,
  BookOpen,
  Edit3,
  Bot,
  CheckCircle2,
  Lightbulb,
  Zap,
  Save,
  RotateCcw,
  Maximize2,
  Minimize2,
  MessageSquareQuote,
  Send,
  Copy,
  Check,
  Trash2,
  Loader2,
  Bookmark,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
  List,
  CheckSquare,
  Square,
  Clock,
  Quote,
  X,
} from 'lucide-react';
import {
  PMLearningCourse,
  PMLearningReflectionItem,
  CONTENT_TYPE_CONFIG,
  PMLearningChapterUnit,
  PMLearningChecklistItem,
} from '@/types/pm-learning';
import { MarkdownPreview } from './markdown-preview';
import { SmartArticleEditor } from './smart-article-editor';
import {
  analyzeArticleContentAction,
  askArticleQuestionAction,
  updatePMMemberProgress,
  updatePMLearningCourse,
} from '@/lib/pm-learning-actions';
import { normalizeChecklistToChapters } from '@/lib/pm-learning-utils';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils';

interface ArticleReaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  course: PMLearningCourse | null;
  currentUserId?: string;
  initialOpenChat?: boolean;
  initialChapterIndex?: number;
  onEdit?: (course: PMLearningCourse) => void;
  onCourseUpdated?: (course: PMLearningCourse) => void;
}

export function ArticleReaderDialog({
  isOpen,
  onClose,
  course,
  currentUserId,
  initialOpenChat = false,
  initialChapterIndex,
  onEdit,
  onCourseUpdated,
}: ArticleReaderDialogProps) {
  const { toast } = useToast();

  // 1. 全域視窗與側欄狀態 (保證所有 Hook 在頂部無條件宣告)
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'notes'>('ai');
  const [isChaptersExpanded, setIsChaptersExpanded] = useState(true);
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(true);

  // 2. AI 分析與問答狀態
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; createdAt?: string; model?: string }[]
  >([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savingNoteIndex, setSavingNoteIndex] = useState<number | null>(null);
  const [savedNoteIndex, setSavedNoteIndex] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 3. 心得筆記與札記狀態
  const [personalNotes, setPersonalNotes] = useState('');
  const [newThoughtInput, setNewThoughtInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // 4. 系列篇章結構支援
  const chapters: PMLearningChapterUnit[] = useMemo(() => {
    if (!course?.defaultChecklist || !Array.isArray(course.defaultChecklist)) return [];
    return normalizeChecklistToChapters(course.defaultChecklist);
  }, [course?.defaultChecklist]);

  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(-1);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // 6. 隨讀圖文即時編輯/貼上狀態
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editorDraftContent, setEditorDraftContent] = useState('');
  const [isSavingContent, setIsSavingContent] = useState(false);

  // 7. 本機對話快取 Key
  const chatStorageKey = course?.id ? `pm_learning_chat_${course.id}_${currentUserId || 'default'}` : '';

  // 監聽是否外部傳入預設開啟 AI 提問
  useEffect(() => {
    if (isOpen && initialOpenChat) {
      setIsSidebarOpen(true);
      setSidebarTab('ai');
    }
  }, [isOpen, initialOpenChat]);

  // 切換文章時，載入本機快取之問答對話歷程
  useEffect(() => {
    if (!chatStorageKey) {
      setChatMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
          setQuestionInput('');
          setIsAsking(false);
          return;
        }
      }
    } catch {}
    setChatMessages([]);
    setQuestionInput('');
    setIsAsking(false);
  }, [chatStorageKey]);

  // 初始化個人筆記
  useEffect(() => {
    if (course && currentUserId) {
      const prog = (course.memberProgress || {})[currentUserId];
      setPersonalNotes(prog?.notes || '');
    } else {
      setPersonalNotes('');
    }
  }, [course, currentUserId]);

  // 智慧定位篇章 (若有指定 initialChapterIndex 則優先使用，否則定位至第一個未讀或第一篇)
  useEffect(() => {
    if (!course) {
      setActiveChapterIndex(-1);
      return;
    }

    if (chapters.length > 0) {
      if (typeof initialChapterIndex === 'number' && initialChapterIndex >= 0 && initialChapterIndex < chapters.length) {
        setActiveChapterIndex(initialChapterIndex);
        return;
      }

      const currentMemberProg = (course.memberProgress || {})[currentUserId || ''];
      const userChecklist: PMLearningChecklistItem[] = Array.isArray(currentMemberProg?.checklist)
        ? currentMemberProg.checklist
        : [];

      const firstUncompleted = chapters.findIndex((c) => {
        if (userChecklist.length === 0) return true;
        const matching = userChecklist.filter(
          (item) =>
            (item.chapterTitle && item.chapterTitle.trim() === c.title.trim()) ||
            item.title.trim() === c.title.trim()
        );
        return matching.length === 0 || !matching.every((m) => m.completed);
      });

      setActiveChapterIndex(firstUncompleted >= 0 ? firstUncompleted : 0);
    } else {
      setActiveChapterIndex(-1);
    }
  }, [course?.id, chapters.length, initialChapterIndex]);

  // ==========================================
  // 所有 Hooks 宣告完畢！以下安全處理 course 為空的情境
  // ==========================================
  if (!course) {
    return null;
  }

  const typeConfig = CONTENT_TYPE_CONFIG[course.type || 'course'] || CONTENT_TYPE_CONFIG['course'];
  const hasAiAnalysis = Boolean(course.aiAnalysis?.summary);

  // 目前登入使用者的檢核紀錄與札記
  const currentMemberProg = (course.memberProgress || {})[currentUserId || ''];
  const userChecklist: PMLearningChecklistItem[] = Array.isArray(currentMemberProg?.checklist)
    ? currentMemberProg.checklist
    : [];
  const reflections: PMLearningReflectionItem[] = Array.isArray(currentMemberProg?.reflections)
    ? currentMemberProg.reflections
    : [];

  const isChapterCompleted = (chap: PMLearningChapterUnit) => {
    if (userChecklist.length === 0) return false;
    const matching = userChecklist.filter(
      (item) =>
        (item.chapterTitle && item.chapterTitle.trim() === chap.title.trim()) ||
        item.title.trim() === chap.title.trim()
    );
    if (matching.length > 0) {
      return matching.every((m) => m.completed);
    }
    return false;
  };

  const completedChaptersCount = chapters.filter(isChapterCompleted).length;

  // 標記/切換單篇篇目已讀
  const handleToggleChapterComplete = async (chap: PMLearningChapterUnit) => {
    if (!currentUserId || !course) {
      toast({ title: '請先登入後更新進度', variant: 'destructive' });
      return;
    }
    setIsUpdatingProgress(true);
    try {
      const willBeCompleted = !isChapterCompleted(chap);

      let updatedChecklist = [...userChecklist];
      let hasMatching = false;
      updatedChecklist = updatedChecklist.map((item) => {
        if (
          (item.chapterTitle && item.chapterTitle.trim() === chap.title.trim()) ||
          item.title.trim() === chap.title.trim()
        ) {
          hasMatching = true;
          return {
            ...item,
            completed: willBeCompleted,
            completedAt: willBeCompleted ? new Date().toISOString() : undefined,
          };
        }
        return item;
      });

      if (!hasMatching) {
        updatedChecklist.push({
          id: `chk-${Date.now()}`,
          title: chap.title,
          chapterTitle: chap.title,
          completed: willBeCompleted,
          completedAt: willBeCompleted ? new Date().toISOString() : undefined,
        });
      }

      const totalItems = updatedChecklist.length;
      const completedItems = updatedChecklist.filter((c) => c.completed).length;
      const newPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      const isCompleted = newPercent >= 100;

      const res = await updatePMMemberProgress(course.id, currentUserId, {
        checklist: updatedChecklist,
        progressPercent: newPercent,
        isCompleted,
      });

      if (res.success && res.data) {
        const updatedCourse: PMLearningCourse = {
          ...course,
          memberProgress: {
            ...(course.memberProgress || {}),
            [currentUserId]: res.data,
          },
        };
        if (onCourseUpdated) {
          onCourseUpdated(updatedCourse);
        }
        toast({
          title: willBeCompleted ? '✅ 本篇已標記為已讀' : '已標記為未完成',
          description: `「${chap.title}」進度已同步，全系列目前為 ${newPercent}% (${completedItems}/${totalItems})`,
        });
      } else {
        toast({ title: '進度儲存失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '更新進度出錯', description: err?.message, variant: 'destructive' });
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // 篇章前後切換
  const handleGoNextChapter = () => {
    if (activeChapterIndex < chapters.length - 1) {
      setIsEditingContent(false);
      setActiveChapterIndex((prev) => prev + 1);
    }
  };

  const handleGoPrevChapter = () => {
    if (activeChapterIndex > 0) {
      setIsEditingContent(false);
      setActiveChapterIndex((prev) => prev - 1);
    } else if (activeChapterIndex === 0) {
      setIsEditingContent(false);
      setActiveChapterIndex(-1);
    }
  };

  // 觸發 AI 重點導讀與摘要分析
  const handleTriggerAI = async () => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeArticleContentAction(course.id);
      if (res.success && res.data) {
        toast({
          title: '🤖 AI 重點導讀分析完成！',
          description: '已成功提煉文章核心觀點與專案實務落地建議。',
        });
        if (onCourseUpdated) {
          onCourseUpdated(res.data);
        }
        setIsAiSummaryOpen(true);
      } else {
        toast({
          title: 'AI 分析失敗',
          description: res.message || '請稍後再試',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: '分析發生錯誤',
        description: e?.message || '未知錯誤',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 透過 GPT-6 Luna 進行文章互動提問
  const handleSendQuestion = async (customQuestion?: string) => {
    if (!course) return;
    const q = (customQuestion || questionInput).trim();
    if (!q || isAsking) return;

    const nowStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      role: 'user' as const,
      content: q,
      createdAt: nowStr,
    };

    const newChatWithUser = [...chatMessages, userMsg];
    setChatMessages(newChatWithUser);
    if (chatStorageKey) {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(newChatWithUser));
      } catch {}
    }
    setQuestionInput('');
    setIsAsking(true);
    setIsSidebarOpen(true);
    setSidebarTab('ai');

    try {
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const activeChapterTitle =
        activeChapterIndex >= 0 ? chapters[activeChapterIndex]?.title : undefined;
      const res = await askArticleQuestionAction(course.id, q, historyPayload, activeChapterTitle);
      if (res.success && res.answer) {
        const assistantMsg = {
          role: 'assistant' as const,
          content: res.answer,
          model: res.model || 'gpt-6-luna',
          createdAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => {
          const updated = [...prev, assistantMsg];
          if (chatStorageKey) {
            try {
              localStorage.setItem(chatStorageKey, JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      } else {
        toast({
          title: 'AI 回答失敗',
          description: res.message || '請稍後再試',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '提問發生異常',
        description: err?.message || '未知錯誤',
        variant: 'destructive',
      });
    } finally {
      setIsAsking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // 清空問答對話
  const handleClearChat = () => {
    setChatMessages([]);
    if (chatStorageKey) {
      try {
        localStorage.removeItem(chatStorageKey);
      } catch {}
    }
    toast({ title: '已清空對話紀錄' });
  };

  // 一鍵將 AI 解析存入個人研讀心得筆記與歷程札記
  const handleSaveAnswerToNotes = async (
    msg: { role: string; content: string; model?: string },
    idx: number
  ) => {
    if (!currentUserId || !course) {
      toast({ title: '請先登入後儲存心得筆記', variant: 'destructive' });
      return;
    }

    setSavingNoteIndex(idx);
    try {
      let relatedQ = '';
      for (let i = idx - 1; i >= 0; i--) {
        if (chatMessages[i].role === 'user') {
          relatedQ = chatMessages[i].content;
          break;
        }
      }

      const existingProg = (course.memberProgress || {})[currentUserId];
      const timeStr = new Date().toLocaleString('zh-TW', { hour12: false });
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);

      const noteEntry = [
        `### 💡 AI 智庫深入解析 (${msg.model || 'gpt-6-luna'}) - ${timeStr}`,
        relatedQ ? `> **提問**：${relatedQ}` : '',
        '',
        msg.content,
      ]
        .filter(Boolean)
        .join('\n');

      const existingNotes = personalNotes.trim();
      const updatedNotes = existingNotes ? `${existingNotes}\n\n---\n\n${noteEntry}` : noteEntry;

      const currentChapName =
        activeChapterIndex >= 0 ? chapters[activeChapterIndex]?.title : '🤖 GPT-6 Luna 智庫問答';

      const newReflection: PMLearningReflectionItem = {
        id: `ref-ai-${Date.now()}`,
        createdAt: nowIso,
        content: `**💡 AI 智庫深度解析**\n\n${relatedQ ? `> **問**：${relatedQ}\n\n` : ''}${msg.content}`,
        relatedUnit: currentChapName,
      };
      const existingReflections: PMLearningReflectionItem[] = Array.isArray(existingProg?.reflections)
        ? existingProg.reflections
        : [];
      const updatedReflections = [newReflection, ...existingReflections];

      const res = await updatePMMemberProgress(course.id, currentUserId, {
        notes: updatedNotes,
        reflections: updatedReflections,
        progressPercent: existingProg?.progressPercent ?? (updatedNotes ? 100 : 0),
        isCompleted: existingProg?.isCompleted ?? Boolean(updatedNotes),
      });

      if (res.success && res.data) {
        setPersonalNotes(updatedNotes);
        const updatedCourse: PMLearningCourse = {
          ...course,
          memberProgress: {
            ...(course.memberProgress || {}),
            [currentUserId]: res.data,
          },
        };
        if (onCourseUpdated) {
          onCourseUpdated(updatedCourse);
        }
        setSavedNoteIndex(idx);
        setTimeout(() => setSavedNoteIndex(null), 3000);
        setSidebarTab('notes');
        toast({
          title: '📌 已成功歸檔至「我的想法札記」！',
          description: '已同步至雲端資料庫（實務心得與歷程札記）。',
        });
      } else {
        toast({
          title: '儲存失敗',
          description: res.message || '無法寫入心得紀錄',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '儲存出錯',
        description: err?.message || '未知錯誤',
        variant: 'destructive',
      });
    } finally {
      setSavingNoteIndex(null);
    }
  };

  // 隨時新增一則自己的想法札記
  const handleAddNewThought = async () => {
    if (!currentUserId || !course) {
      toast({ title: '請先登入後儲存想法', variant: 'destructive' });
      return;
    }
    const thought = newThoughtInput.trim();
    if (!thought) return;

    setIsSavingNotes(true);
    try {
      const existingProg = (course.memberProgress || {})[currentUserId];
      const timeStr = new Date().toLocaleString('zh-TW', { hour12: false });
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const currentChapName =
        activeChapterIndex >= 0 ? chapters[activeChapterIndex]?.title : '隨筆心得';

      // 1. 同步加入歷程札記
      const newReflection: PMLearningReflectionItem = {
        id: `ref-user-${Date.now()}`,
        createdAt: nowIso,
        content: thought,
        relatedUnit: currentChapName,
      };
      const existingReflections: PMLearningReflectionItem[] = Array.isArray(existingProg?.reflections)
        ? existingProg.reflections
        : [];
      const updatedReflections = [newReflection, ...existingReflections];

      // 2. 彙整加入 notes
      const noteEntry = `### ✍️ 研習心得 (${currentChapName}) - ${timeStr}\n\n${thought}`;
      const existingNotes = personalNotes.trim();
      const updatedNotes = existingNotes ? `${existingNotes}\n\n---\n\n${noteEntry}` : noteEntry;

      const res = await updatePMMemberProgress(course.id, currentUserId, {
        notes: updatedNotes,
        reflections: updatedReflections,
        progressPercent: existingProg?.progressPercent ?? 100,
        isCompleted: existingProg?.isCompleted ?? true,
      });

      if (res.success && res.data) {
        setPersonalNotes(updatedNotes);
        setNewThoughtInput('');
        const updatedCourse: PMLearningCourse = {
          ...course,
          memberProgress: {
            ...(course.memberProgress || {}),
            [currentUserId]: res.data,
          },
        };
        if (onCourseUpdated) {
          onCourseUpdated(updatedCourse);
        }
        toast({
          title: '💡 想法札記已成功記錄！',
          description: `已記錄至「${currentChapName}」研習歷程。`,
        });
      } else {
        toast({ title: '記錄失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '記錄出錯', description: err?.message, variant: 'destructive' });
    } finally {
      setIsSavingNotes(false);
    }
  };

  // 取得主體呈現文字
  const mainMarkdown =
    course.content ||
    course.videoTimestampNotes ||
    course.bookQuotesAndReflections ||
    course.description ||
    '（尚未填寫內文）';

  // 當前閱讀章節物件
  const currentChapter = activeChapterIndex >= 0 ? chapters[activeChapterIndex] : null;
  const currentChapterContent = currentChapter?.content?.trim();

  // 開啟隨讀圖文編輯器
  const handleOpenContentEditor = () => {
    if (activeChapterIndex >= 0 && currentChapter) {
      setEditorDraftContent(currentChapter.content || '');
    } else {
      setEditorDraftContent(course.content || '');
    }
    setIsEditingContent(true);
  };

  // 取消編輯
  const handleCancelContentEditor = () => {
    setIsEditingContent(false);
    setEditorDraftContent('');
  };

  // 儲存圖文內容（即時寫入雲端資料庫並同步更新父層）
  const handleSaveContent = async () => {
    if (!course) return;
    setIsSavingContent(true);
    try {
      if (activeChapterIndex >= 0 && currentChapter) {
        // 更新特定篇章的 content
        const updatedChapters = chapters.map((c, idx) => {
          if (idx === activeChapterIndex) {
            return { ...c, content: editorDraftContent };
          }
          return c;
        });
        const res = await updatePMLearningCourse(course.id, {
          defaultChecklist: updatedChapters,
        });
        if (res.success && res.data) {
          if (onCourseUpdated) onCourseUpdated(res.data);
          setIsEditingContent(false);
          toast({
            title: '✅ 本篇圖文內容已成功儲存！',
            description: `已成功保存「${currentChapter.title}」之內文與圖表數據。`,
          });
        } else {
          toast({
            title: '儲存失敗',
            description: res.message || '無法儲存篇章內文',
            variant: 'destructive',
          });
        }
      } else {
        // 全文總覽模式
        const res = await updatePMLearningCourse(course.id, {
          content: editorDraftContent,
        });
        if (res.success && res.data) {
          if (onCourseUpdated) onCourseUpdated(res.data);
          setIsEditingContent(false);
          toast({
            title: '✅ 全文圖文內容已成功儲存！',
            description: '已成功更新本項目主要內文與圖表數據。',
          });
        } else {
          toast({
            title: '儲存失敗',
            description: res.message || '無法儲存全文內容',
            variant: 'destructive',
          });
        }
      }
    } catch (err: any) {
      toast({
        title: '儲存出錯',
        description: err?.message || '未知錯誤',
        variant: 'destructive',
      });
    } finally {
      setIsSavingContent(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 overflow-hidden bg-white shadow-2xl transition-all duration-200 border-slate-200 ${
          isFullScreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none inset-0 translate-x-0 translate-y-0 left-0 top-0'
            : 'max-w-7xl w-[96vw] h-[92vh] max-h-[92vh] rounded-2xl'
        }`}
      >
        {/* 頂部極簡 Header 工具列 */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 select-none">
          {/* 左側：類型、標題、來源與系列資訊 */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Badge className={`${typeConfig.badgeClass} shrink-0 text-xs py-0.5`}>
              <span className="mr-1">{typeConfig.icon}</span>
              {typeConfig.label}
            </Badge>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
                  {course.title}
                </DialogTitle>

                {chapters.length > 0 && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-semibold shrink-0">
                    📚 系列共 {chapters.length} 篇 · 已讀 {completedChaptersCount} 篇
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 pt-0.5 flex-wrap">
                {(course.source || course.instructorOrPlatform) && (
                  <span className="flex items-center gap-1 font-medium text-slate-700 truncate">
                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{course.source || course.instructorOrPlatform}</span>
                    {course.subSource && <span className="text-indigo-600 font-semibold">({course.subSource})</span>}
                  </span>
                )}
                {course.issueDate && (
                  <span className="flex items-center gap-1 text-slate-400 font-mono">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    {course.issueDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 右側：動作按鈕群組 (極簡乾淨) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 系列篇章目錄開關 */}
            {chapters.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsChaptersExpanded((prev) => !prev)}
                className={`h-8 text-xs gap-1.5 font-semibold transition-all ${
                  isChaptersExpanded
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title={isChaptersExpanded ? '收起系列篇章目錄' : '展開系列篇章目錄'}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">{isChaptersExpanded ? '收起目錄' : '展開目錄'}</span>
              </Button>
            )}

            {/* 記想法 / 問 AI 側欄切換按鈕 */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setSidebarTab('ai');
                } else {
                  setSidebarTab((prev) => (prev === 'ai' ? 'notes' : 'ai'));
                }
              }}
              className={`h-8 text-xs gap-1.5 font-semibold transition-all ${
                isSidebarOpen
                  ? sidebarTab === 'ai'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="切換隨讀側邊欄 (問 AI / 記想法)"
            >
              {sidebarTab === 'ai' && isSidebarOpen ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span className="hidden md:inline">詢問 AI 中</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">我的想法</span>
                </>
              )}
            </Button>

            {/* 快速貼上 / 編輯圖文按鈕 */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (isEditingContent) {
                  setIsEditingContent(false);
                } else {
                  handleOpenContentEditor();
                }
              }}
              className={`h-8 text-xs gap-1.5 font-semibold transition-all cursor-pointer ${
                isEditingContent
                  ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                  : 'text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isEditingContent ? '退出編輯模式' : '快速貼上 / 編輯圖文內容 (支援圖片直接貼入)'}
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">{isEditingContent ? '退出編輯' : '貼上/編輯圖文'}</span>
            </Button>

            {/* 側邊欄展開/收起開關 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              title={isSidebarOpen ? '收起隨讀輔助欄 (純粹閱讀模式)' : '展開隨讀輔助欄 (問AI / 記筆記)'}
            >
              {isSidebarOpen ? (
                <PanelRightClose className="w-4 h-4 text-slate-600" />
              ) : (
                <PanelRightOpen className="w-4 h-4 text-indigo-600" />
              )}
            </Button>

            {/* 原文連結 */}
            {course.externalUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                asChild
                title="開啟原文出處連結"
              >
                <a href={course.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            )}

            {/* 編輯 */}
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                onClick={() => {
                  onClose();
                  onEdit(course);
                }}
                title="編輯此項目"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* 全螢幕切換 */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              onClick={() => setIsFullScreen((prev) => !prev)}
              title={isFullScreen ? '視窗模式' : '滿版全螢幕模式'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>

            {/* 關閉按鈕 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-1"
              title="關閉閱讀視窗"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 主體區：左側閱讀正文 + 右側隨讀助手側欄 (可一鍵收起展開) */}
        <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50/50">
          {/* 左側：主閱讀空間 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
            {/* 1. 系列篇章導航 (可展開 / 縮起) */}
            {chapters.length > 0 && (
              <div className="border-b border-slate-200/80 bg-slate-50/70 shrink-0">
                {/* 縮起狀態：單行極簡條 */}
                {!isChaptersExpanded ? (
                  <div className="px-5 py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" />
                        <span>
                          {activeChapterIndex === -1
                            ? '📑 全文總覽'
                            : `第 ${activeChapterIndex + 1} 篇 / 共 ${chapters.length} 篇`}
                        </span>
                      </span>
                      {currentChapter && (
                        <span className="text-slate-800 font-semibold truncate border-l border-slate-200 pl-2">
                          {currentChapter.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsChaptersExpanded(true)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>展開系列篇章目錄 ({chapters.length} 篇)</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>

                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={activeChapterIndex <= 0}
                          onClick={handleGoPrevChapter}
                          className="h-6 w-6 p-0 text-slate-500 hover:bg-slate-200"
                          title="上一篇"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={activeChapterIndex >= chapters.length - 1}
                          onClick={handleGoNextChapter}
                          className="h-6 w-6 p-0 text-slate-500 hover:bg-slate-200"
                          title="下一篇"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 展開狀態：乾淨俐落的篇章橫向滾動或標籤 */
                  <div className="px-5 py-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-indigo-600" />
                          <span>系列篇章目錄</span>
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          （共 {chapters.length} 篇 · 已讀 {completedChaptersCount} 篇）
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsChaptersExpanded(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>縮起目錄</span>
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                      {/* 全文總覽按鈕 */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingContent(false);
                          setActiveChapterIndex(-1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          activeChapterIndex === -1
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>📑 全文總覽</span>
                      </button>

                      {/* 各篇章按鈕 */}
                      {chapters.map((chap, cIdx) => {
                        const isDone = isChapterCompleted(chap);
                        const isActive = activeChapterIndex === cIdx;
                        return (
                          <button
                            key={chap.id || cIdx}
                            type="button"
                            onClick={() => {
                              setIsEditingContent(false);
                              setActiveChapterIndex(cIdx);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                                : isDone
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                            ) : (
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {cIdx + 1}
                              </span>
                            )}
                            <span className="max-w-[180px] sm:max-w-[220px] truncate text-left">{chap.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. 沉浸式內文捲動閱讀區 */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-10 md:px-16 py-8">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* 當前篇目標題列 (若是特定篇目) */}
                {currentChapter && (
                  <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          第 {activeChapterIndex + 1} 篇 / 共 {chapters.length} 篇
                        </span>
                        {currentChapter.url && (
                          <a
                            href={currentChapter.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>原文網址</span>
                          </a>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {currentChapter.title}
                      </h2>
                    </div>

                    {/* 標記本篇已讀按鈕 */}
                    <Button
                      size="sm"
                      disabled={isUpdatingProgress}
                      onClick={() => handleToggleChapterComplete(currentChapter)}
                      className={`h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-xs transition-all ${
                        isChapterCompleted(currentChapter)
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {isChapterCompleted(currentChapter) ? '✅ 本篇已標記完讀' : '標記此篇為已讀'}
                      </span>
                    </Button>
                  </div>
                )}

                {/* 模式切換：編輯圖文 or 沉浸式閱讀 */}
                {isEditingContent ? (
                  <div className="bg-slate-50 border border-indigo-200 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm animate-in fade-in-50">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-sm text-slate-800">
                          {currentChapter
                            ? `正在編輯：第 ${activeChapterIndex + 1} 篇《${currentChapter.title}》圖文內容`
                            : '正在編輯：全文總覽圖文內容'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelContentEditor}
                          disabled={isSavingContent}
                          className="h-8 text-xs text-slate-600 cursor-pointer"
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveContent}
                          disabled={isSavingContent}
                          className="h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
                        >
                          {isSavingContent ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>{isSavingContent ? '儲存中...' : '儲存內文'}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                      💡 <strong>一鍵貼上提示</strong>：
                      可在 Notion、網頁或 Word 中按 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono text-[11px]">Ctrl+A</kbd> 全選複製，並於下方輸入框按 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono text-[11px]">Ctrl+V</kbd> 貼上。
                      文字、標題、表格與<strong>圖表照片</strong>皆會自動保留！亦可點擊工具列「插入圖片」直接上傳截圖。
                    </div>

                    <SmartArticleEditor
                      value={editorDraftContent}
                      onChange={setEditorDraftContent}
                      minHeight="420px"
                      rows={18}
                      placeholder="請在此處按 Ctrl+V 貼上圖文（支援圖片直接貼入），或輸入重點內文..."
                      showPreviewTab={true}
                    />

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelContentEditor}
                        disabled={isSavingContent}
                        className="h-8 text-xs text-slate-600"
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {isSavingContent ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavingContent ? '儲存中...' : '儲存內文'}</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 正文閱讀 Markdown 內容 */
                  <div className="prose prose-slate max-w-none leading-relaxed text-slate-800 text-base md:text-lg">
                    {currentChapter ? (
                      currentChapterContent ? (
                        <MarkdownPreview content={currentChapterContent} readingMode={true} />
                      ) : mainMarkdown !== '（尚未填寫內文）' ? (
                        <div className="space-y-4">
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>提示：本篇共享全系列主內文。您也可以為此篇貼入獨立專屬圖文。</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleOpenContentEditor}
                              className="h-7 text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              為此篇貼入圖文
                            </Button>
                          </div>
                          <MarkdownPreview content={mainMarkdown} readingMode={true} />
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-3">
                          <FileText className="w-8 h-8 mx-auto text-slate-400" />
                          <p className="font-semibold text-slate-700">第 {activeChapterIndex + 1} 篇尚未填寫獨立內文</p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            您可以直接一鍵貼入 Notion/網頁文章與圖表，或查閱全文總覽！
                          </p>
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={handleOpenContentEditor}
                              className="h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>一鍵貼上本篇圖文 (支援圖片直接貼入)</span>
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      /* 全文總覽模式 */
                      <div>
                        {mainMarkdown === '（尚未填寫內文）' && (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-3 mb-6">
                            <FileText className="w-8 h-8 mx-auto text-slate-400" />
                            <p className="font-semibold text-slate-700">本項目尚未填寫內文</p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                              您可以直接將 Notion / 網頁中的圖文一鍵貼上，系統會完整保留圖表與文章架構！
                            </p>
                            <div className="pt-2">
                              <Button
                                size="sm"
                                onClick={handleOpenContentEditor}
                                className="h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>立即一鍵貼上圖文</span>
                              </Button>
                            </div>
                          </div>
                        )}
                        <MarkdownPreview content={mainMarkdown} readingMode={true} />
                      </div>
                    )}
                  </div>
                )}

                {/* 篇末切換與翻頁導覽 (僅當有章節時) */}
                {chapters.length > 0 && activeChapterIndex >= 0 && (
                  <div className="pt-8 pb-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activeChapterIndex <= 0}
                      onClick={handleGoPrevChapter}
                      className="h-9 px-4 text-xs font-semibold gap-1.5 text-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>上一篇</span>
                    </Button>

                    <div className="flex items-center gap-2">
                      {currentChapter && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingProgress}
                          onClick={() => handleToggleChapterComplete(currentChapter)}
                          className="h-9 px-4 text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          <CheckCircle2 className={`h-4 w-4 ${isChapterCompleted(currentChapter) ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>{isChapterCompleted(currentChapter) ? '已讀完畢' : '標記此篇為已讀'}</span>
                        </Button>
                      )}
                    </div>

                    {activeChapterIndex < chapters.length - 1 ? (
                      <Button
                        size="sm"
                        onClick={handleGoNextChapter}
                        className="h-9 px-4 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      >
                        <span>閱讀下一篇</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (currentChapter && !isChapterCompleted(currentChapter)) {
                            handleToggleChapterComplete(currentChapter);
                          }
                          toast({
                            title: '🎉 太棒了！全系列篇章已全部研讀完畢！',
                            description: '恭喜完整掌握本系列核心知識脈絡。',
                          });
                        }}
                        className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>全系列已完讀</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側：隨讀助手側欄 (問 AI / 記想法) */}
          {isSidebarOpen && (
            <div className="w-[380px] lg:w-[420px] border-l border-slate-200 bg-white flex flex-col shrink-0 shadow-lg animate-in slide-in-from-right-4 duration-200">
              {/* 側欄分頁切換 Tabs */}
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('ai')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      sidebarTab === 'ai'
                        ? 'bg-white text-purple-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>💬 詢問 AI</span>
                    {chatMessages.length > 0 && (
                      <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 rounded-full font-mono">
                        {chatMessages.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('notes')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      sidebarTab === 'notes'
                        ? 'bg-white text-amber-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>✍️ 我的想法</span>
                    {reflections.length > 0 && (
                      <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 rounded-full font-mono">
                        {reflections.length}
                      </span>
                    )}
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                  title="收起側欄"
                >
                  <PanelRightClose className="w-4 h-4" />
                </Button>
              </div>

              {/* 側欄分頁 1：詢問 AI (GPT-6 Luna + AI 重點導讀) */}
              {sidebarTab === 'ai' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* 可折疊之 AI 重點導讀區塊 */}
                  <div className="border-b border-slate-100 bg-purple-50/30 p-3 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAiSummaryOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 text-xs font-bold text-purple-950 hover:underline cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>AI 重點導讀速覽</span>
                        {isAiSummaryOpen ? <ChevronUp className="h-3 w-3 text-purple-500" /> : <ChevronDown className="h-3 w-3 text-purple-500" />}
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isAnalyzing}
                        onClick={handleTriggerAI}
                        className="h-6 text-[11px] text-purple-700 hover:bg-purple-100/60 px-2 font-medium"
                      >
                        {isAnalyzing ? (
                          <>
                            <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                            <span>分析中...</span>
                          </>
                        ) : (
                          <span>{hasAiAnalysis ? '重新導讀' : '一鍵產生導讀'}</span>
                        )}
                      </Button>
                    </div>

                    {isAiSummaryOpen && (
                      <div className="mt-2 text-xs text-slate-700 max-h-48 overflow-y-auto space-y-2 pr-1">
                        {hasAiAnalysis ? (
                          <div className="space-y-2">
                            <p className="leading-relaxed bg-white/90 p-2.5 rounded-lg border border-purple-100 text-slate-700">
                              {course.aiAnalysis?.summary}
                            </p>
                            {Array.isArray(course.aiAnalysis?.keyTakeaways) && course.aiAnalysis.keyTakeaways.length > 0 && (
                              <div className="bg-white/90 p-2.5 rounded-lg border border-purple-100 space-y-1">
                                <span className="font-bold text-purple-900 block">📌 核心關鍵收穫：</span>
                                <ul className="space-y-1 pl-1">
                                  {course.aiAnalysis.keyTakeaways.map((k, i) => (
                                    <li key={i} className="flex items-start gap-1 text-[11px] text-slate-600">
                                      <span className="text-purple-600 font-bold shrink-0">•</span>
                                      <span>{k}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-white/60 rounded-lg border border-dashed border-purple-200 text-slate-500 text-[11px]">
                            點選右上角「一鍵產生導讀」提煉本文關鍵重點與實務落地建議！
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AI 對話歷程區 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-6 px-3 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
                          <MessageSquareQuote className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">歡迎向 GPT-6 Luna 智庫顧問提問！</p>
                          <p className="text-[11px] text-slate-500">
                            您可以直接針對當前篇目提出疑問，解答後還可一鍵轉存入個人想法筆記：
                          </p>
                        </div>

                        {/* 快捷問題 */}
                        <div className="flex flex-col gap-1.5 pt-2">
                          {[
                            '💡 本篇核心重點與啟發是什麼？',
                            '💡 專案現場落地時有何具體做法？',
                            '💡 常見實務風險與因應策略？',
                          ].map((prompt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendQuestion(prompt.replace(/^[💡\s]+/, ''))}
                              disabled={isAsking}
                              className="text-xs bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-lg px-2.5 py-1.5 text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                              <Sparkles className="w-3 h-3" />
                            </div>
                          )}

                          <div
                            className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-xs'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs space-y-1.5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] opacity-75 mb-1">
                              <span className="font-semibold">{msg.role === 'user' ? '您' : 'GPT-6 Luna'}</span>
                              <span>{msg.createdAt}</span>
                            </div>

                            {msg.role === 'user' ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <div className="prose prose-xs max-w-none text-slate-800">
                                <MarkdownPreview content={msg.content} />
                              </div>
                            )}

                            {msg.role === 'assistant' && (
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSaveAnswerToNotes(msg, idx)}
                                  disabled={savingNoteIndex === idx}
                                  className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                    savedNoteIndex === idx
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                                  }`}
                                  title="將此解析一鍵存入我的想法筆記 (雲端永久保存)"
                                >
                                  {savedNoteIndex === idx ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>已存入想法</span>
                                    </>
                                  ) : savingNoteIndex === idx ? (
                                    <>
                                      <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                                      <span>儲存中...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bookmark className="w-3 h-3 text-amber-600" />
                                      <span>📌 存入想法</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    copyToClipboard(msg.content);
                                    setCopiedIndex(idx);
                                    setTimeout(() => setCopiedIndex(null), 2000);
                                  }}
                                  className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  {copiedIndex === idx ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {isAsking && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs animate-pulse">
                          <Sparkles className="w-3 h-3" />
                        </div>
                        <div className="bg-white border border-purple-200 text-slate-700 rounded-2xl rounded-tl-xs p-3 text-xs shadow-2xs flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                          <span className="font-medium text-purple-900">GPT-6 Luna 深度思考回答中...</span>
                        </div>
                      </div>
                    )}

                    <div ref={chatBottomRef} />
                  </div>

                  {/* 底部提問輸入列 */}
                  <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0">
                    <Textarea
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendQuestion();
                        }
                      }}
                      placeholder={`向 AI 提出針對此${typeConfig.label}的疑問... (Enter 送出)`}
                      rows={1}
                      className="min-h-[38px] max-h-[100px] text-xs resize-none bg-slate-50 focus:bg-white border-slate-200 focus-visible:ring-purple-400 py-2"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isAsking || !questionInput.trim()}
                      onClick={() => handleSendQuestion()}
                      className="h-[38px] px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1 shrink-0 cursor-pointer"
                    >
                      {isAsking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>送出</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* 側欄分頁 2：我的想法札記 (方便每次隨手記錄自己的想法與反思) */}
              {sidebarTab === 'notes' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/30">
                  {/* 快速記錄自己的想法輸入框 */}
                  <div className="p-4 bg-white border-b border-slate-200 space-y-2.5 shrink-0 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        <span>記錄本次研讀想法或反思</span>
                      </span>
                      {currentChapter && (
                        <span className="text-[10px] text-slate-400 max-w-[160px] truncate">
                          針對：{currentChapter.title}
                        </span>
                      )}
                    </div>

                    <Textarea
                      value={newThoughtInput}
                      onChange={(e) => setNewThoughtInput(e.target.value)}
                      placeholder="讀到這裡有什麼靈感、疑問或可套用於專案現場的做法？寫下來儲存..."
                      rows={3}
                      className="text-xs bg-amber-50/30 border-amber-200 focus:bg-white resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">儲存後自動同步至個人歷程札記</span>
                      <Button
                        size="sm"
                        disabled={isSavingNotes || !newThoughtInput.trim()}
                        onClick={handleAddNewThought}
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 px-3 shadow-2xs"
                      >
                        {isSavingNotes ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>儲存中...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3" />
                            <span>儲存想法</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 歷史想法與反思歷程清單 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                      <span>思考成長軌跡 ({reflections.length} 則)</span>
                    </div>

                    {reflections.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-xl border border-dashed border-amber-200 p-4 space-y-2">
                        <Bookmark className="w-7 h-7 mx-auto text-amber-400 opacity-60" />
                        <p className="text-xs font-semibold text-slate-700">尚未記錄個人想法</p>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          您可以在上方隨手寫下心得，或在問答 AI 時點選「📌 存入想法」，想法會永久歸檔於此！
                        </p>
                      </div>
                    ) : (
                      reflections.map((ref, idx) => (
                        <div
                          key={ref.id || idx}
                          className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 border-b border-amber-50 pb-1">
                            <span className="font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded">
                              {ref.relatedUnit || '心得札記'}
                            </span>
                            <span>{ref.createdAt}</span>
                          </div>
                          <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                            <MarkdownPreview content={ref.content} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部極簡 Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-600">
              億威電子 · PMO 專案知識與成長地圖
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">
              關閉閱讀
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
