'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Sparkles,
  ExternalLink,
  Calendar,
  Clock,
  Tag,
  Building2,
  BookOpen,
  Edit3,
  Bot,
  CheckCircle2,
  Lightbulb,
  Zap,
  Save,
  RotateCcw,
  Video,
  Share2,
  Maximize2,
  Minimize2,
  MessageSquare,
  MessageSquareQuote,
  Send,
  Copy,
  Check,
  Trash2,
  HelpCircle,
  Loader2,
  Bookmark,
} from 'lucide-react';
import { PMLearningCourse, PMLearningReflectionItem, CONTENT_TYPE_CONFIG } from '@/types/pm-learning';
import { MarkdownPreview } from './markdown-preview';
import { analyzeArticleContentAction, askArticleQuestionAction, updatePMMemberProgress } from '@/lib/pm-learning-actions';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils';

interface ArticleReaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  course: PMLearningCourse | null;
  currentUserId?: string;
  initialOpenChat?: boolean;
  onEdit?: (course: PMLearningCourse) => void;
  onCourseUpdated?: (course: PMLearningCourse) => void;
}

export function ArticleReaderDialog({
  isOpen,
  onClose,
  course,
  currentUserId,
  initialOpenChat = false,
  onEdit,
  onCourseUpdated,
}: ArticleReaderDialogProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiCard, setShowAiCard] = useState(true);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // AI 提問對話狀態 (GPT-6 Luna)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; createdAt?: string; model?: string }[]
  >([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savingNoteIndex, setSavingNoteIndex] = useState<number | null>(null);
  const [savedNoteIndex, setSavedNoteIndex] = useState<number | null>(null);
  const chatBottomRef = React.useRef<HTMLDivElement>(null);

  // 本機對話快取 Key (離開視窗或重新整理後依然保留對話)
  const chatStorageKey = course?.id ? `pm_learning_chat_${course.id}_${currentUserId || 'default'}` : '';

  // 監聽是否外部傳入預設開啟 AI 提問
  React.useEffect(() => {
    if (isOpen && initialOpenChat) {
      setIsChatOpen(true);
    }
  }, [isOpen, initialOpenChat]);

  // 切換文章時，載入本機快取之問答對話歷程 (防離開後遺失)
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (course && currentUserId) {
      const prog = (course.memberProgress || {})[currentUserId];
      setPersonalNotes(prog?.notes || '');
    } else {
      setPersonalNotes('');
    }
  }, [course, currentUserId]);

  if (!course) return null;

  const typeConfig = CONTENT_TYPE_CONFIG[course.type || 'course'] || CONTENT_TYPE_CONFIG['course'];
  const hasAiAnalysis = Boolean(course.aiAnalysis?.summary);

  // 觸發 AI 重點導讀與摘要分析
  const handleTriggerAI = async () => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeArticleContentAction(course.id);
      if (res.success && res.data) {
        toast({
          title: '🤖 AI 重點導讀分析完成！',
          description: '已成功提煉文章核心觀點與實務落地建議。',
        });
        if (onCourseUpdated) {
          onCourseUpdated(res.data);
        }
        setShowAiCard(true);
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
    setIsChatOpen(true);

    try {
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await askArticleQuestionAction(course.id, q, historyPayload);
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

  // 清空此文章的對話紀錄
  const handleClearChat = () => {
    setChatMessages([]);
    if (chatStorageKey) {
      try {
        localStorage.removeItem(chatStorageKey);
      } catch {}
    }
    toast({ title: '已清空對話紀錄' });
  };

  // 方案二：一鍵將 AI 深度解析與問題存入個人研讀心得筆記與歷程札記 (雲端永久保存)
  const handleSaveAnswerToNotes = async (
    msg: { role: string; content: string; model?: string },
    idx: number
  ) => {
    if (!currentUserId) {
      toast({ title: '請先登入後儲存心得筆記', variant: 'destructive' });
      return;
    }

    setSavingNoteIndex(idx);
    try {
      // 往前尋找對應的使用者提問
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

      // 1. 格式化為 Markdown 筆記段落
      const noteEntry = [
        `### 💡 AI 智庫深度探討 (${msg.model || 'gpt-6-luna'}) - ${timeStr}`,
        relatedQ ? `> **提問**：${relatedQ}` : '',
        '',
        msg.content,
      ]
        .filter(Boolean)
        .join('\n');

      const existingNotes = personalNotes.trim();
      const updatedNotes = existingNotes ? `${existingNotes}\n\n---\n\n${noteEntry}` : noteEntry;

      // 2. 同步建立一筆歷程札記 (Reflection Item) 供時間軸檢視
      const newReflection: PMLearningReflectionItem = {
        id: `ref-ai-${Date.now()}`,
        createdAt: nowIso,
        content: `**💡 AI 智庫深度探討 (${msg.model || 'gpt-6-luna'})**\n\n${relatedQ ? `> **問**：${relatedQ}\n\n` : ''}${msg.content}`,
        relatedUnit: '🤖 GPT-6 Luna 智庫問答',
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
        setShowNotesEditor(true);
        toast({
          title: '📌 已成功存入個人研讀心得筆記！',
          description: '已同步歸檔至雲端資料庫（實務心得與歷程札記）。',
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

  // 儲存個人研讀筆記與心得
  const handleSavePersonalNotes = async () => {
    if (!currentUserId) {
      toast({ title: '請先登入後儲存心得', variant: 'destructive' });
      return;
    }
    setIsSavingNotes(true);
    try {
      const existingProg = (course.memberProgress || {})[currentUserId];
      const res = await updatePMMemberProgress(course.id, currentUserId, {
        notes: personalNotes,
        progressPercent: existingProg?.progressPercent ?? (personalNotes.trim() ? 100 : 0),
        isCompleted: existingProg?.isCompleted ?? Boolean(personalNotes.trim()),
      });
      if (res.success && res.data) {
        toast({ title: '心得筆記已儲存', description: '已更新您的個人學習紀錄' });
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
        setShowNotesEditor(false);
      } else {
        toast({ title: '儲存失敗', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '儲存出錯', description: err?.message, variant: 'destructive' });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 overflow-hidden transition-all duration-200 bg-white shadow-2xl ${
          isFullScreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none inset-0 translate-x-0 translate-y-0 left-0 top-0'
            : 'max-w-6xl w-[96vw] max-h-[94vh] rounded-2xl'
        }`}
      >
        {/* 頂部 Header */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={typeConfig.badgeClass}>
                <span className="mr-1">{typeConfig.icon}</span>
                {typeConfig.label}
              </Badge>

              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                <Tag className="w-3 h-3 mr-1 text-slate-500" />
                {course.category}
              </Badge>

              {course.subSource && (
                <Badge variant="outline" className="bg-indigo-50/90 text-indigo-900 border-indigo-300 font-bold">
                  📂 {course.subSource}
                </Badge>
              )}

              {course.issueDate && (
                <Badge variant="outline" className="bg-indigo-50/70 text-indigo-700 border-indigo-200 font-mono">
                  <Calendar className="w-3 h-3 mr-1 text-indigo-500" />
                  發布日期: {course.issueDate}
                </Badge>
              )}

              {course.timelinessType === 'time_sensitive' ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                  <Zap className="w-3 h-3 mr-1 text-amber-600" />
                  時效趨勢 (近期關鍵)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                  常青知識
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* 全螢幕 / 寬螢幕切換按鈕 */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
                onClick={() => setIsFullScreen((prev) => !prev)}
                title={isFullScreen ? '切換為視窗模式' : '切換為滿版全螢幕模式'}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">視窗模式</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">全螢幕閱讀</span>
                  </>
                )}
              </Button>

              {course.externalUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-slate-300 hover:border-slate-400 text-slate-700 font-semibold"
                  asChild
                >
                  <a href={course.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>原文出處</span>
                  </a>
                </Button>
              )}

              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-indigo-700 hover:bg-indigo-50 font-semibold"
                  onClick={() => {
                    onClose();
                    onEdit(course);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>編輯</span>
                </Button>
              )}
            </div>
          </div>

          <DialogTitle className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {course.title}
          </DialogTitle>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
            {(course.source || course.instructorOrPlatform) && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-slate-800">
                  {course.source || course.instructorOrPlatform}
                </span>
                {course.subSource && (
                  <span className="text-indigo-600 font-semibold">
                    （{course.subSource}）
                  </span>
                )}
              </div>
            )}
            {course.hours !== undefined && course.hours > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>研習/閱讀：約 {course.hours >= 1 ? `${course.hours} 小時` : `${Math.round(course.hours * 60)} 分鐘`}</span>
              </div>
            )}
          </div>
        </div>

        {/* 捲動內文區 */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
          {/* AI 重點導讀區塊 */}
          <div className="rounded-2xl border border-indigo-200/80 bg-linear-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 p-4 md:p-5 shadow-xs transition-all">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-linear-to-tr from-indigo-600 to-blue-600 text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>AI 重點導讀與專案落地分析</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 font-mono">
                      <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                      <span>{course.aiAnalysis?.modelName?.replace(/(gpt-4o-mini|gpt-5\.6-luna).*/i, 'gpt-6-luna') || 'gpt-6-luna'}</span>
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    針對製造業現場、專案管理基線與{typeConfig.label}提煉核心洞察
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className={`h-8 text-xs font-semibold gap-1.5 shadow-2xs transition-all cursor-pointer ${
                    isChatOpen
                      ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                      : 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-900'
                  }`}
                  title="開啟 AI 互動問答對話介面 (GPT-6 Luna)"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  <span>{isChatOpen ? '收起問答' : '💬 向 AI 提問'}</span>
                  {chatMessages.length > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isChatOpen ? 'bg-white text-purple-700' : 'bg-purple-200 text-purple-900'
                    }`}>
                      {chatMessages.length}
                    </span>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAnalyzing}
                  onClick={handleTriggerAI}
                  className="h-8 text-xs font-semibold gap-1.5 border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 shadow-2xs cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>分析萃取中...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5" />
                      <span>{hasAiAnalysis ? '重新生成導讀' : '一鍵 AI 摘要導讀'}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {hasAiAnalysis ? (
              <div className="space-y-3.5 pt-1 text-xs leading-relaxed text-slate-700">
                {/* 核心摘要 */}
                <div className="bg-white/90 rounded-xl p-3.5 border border-indigo-100 shadow-2xs">
                  <div className="font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>核心觀點速覽</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {course.aiAnalysis?.summary}
                  </p>
                </div>

                {/* 關鍵收穫 */}
                {Array.isArray(course.aiAnalysis?.keyTakeaways) && course.aiAnalysis.keyTakeaways.length > 0 && (
                  <div className="bg-white/90 rounded-xl p-3.5 border border-indigo-100 shadow-2xs">
                    <div className="font-bold text-indigo-950 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>核心脈絡與啟發 (Key Takeaways)</span>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {course.aiAnalysis.keyTakeaways.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-slate-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 實務落地建議 */}
                {Array.isArray(course.aiAnalysis?.actionableInsights) && course.aiAnalysis.actionableInsights.length > 0 && (
                  <div className="bg-white/90 rounded-xl p-3.5 border border-amber-200/70 shadow-2xs">
                    <div className="font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>製造業 / PM 實務借鏡與落地建議 (Action Plan)</span>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {course.aiAnalysis.actionableInsights.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            ▸
                          </span>
                          <span className="text-slate-800 font-medium">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 bg-white/70 rounded-xl border border-dashed border-indigo-200">
                <Bot className="w-7 h-7 mx-auto text-indigo-400 mb-1.5 opacity-70" />
                <p className="text-xs text-slate-600 font-medium">
                  尚未產出 AI 摘要。點擊上方「一鍵 AI 摘要導讀」，快速提煉本文核心重點與專案落地做法！
                </p>
              </div>
            )}

            {/* AI 互動問答對話介面 (GPT-6 Luna) */}
            {isChatOpen && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-white shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
                {/* 對話框標題列 */}
                <div className="px-4 py-2.5 bg-linear-to-r from-purple-50 via-indigo-50/50 to-white border-b border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-purple-600 text-white shadow-2xs">
                      <MessageSquareQuote className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <span>AI 深度問答與研討對話</span>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          gpt-6-luna
                        </span>
                      </h4>
                      <p className="text-[10px] text-purple-600">
                        針對此{typeConfig.label}論述、製造業落地或未盡事宜隨時提出疑問，由 GPT-6 Luna 即時解答
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearChat}
                        className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
                        title="清空目前對話紀錄"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>清空對話</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 對話歷程區 */}
                <div className="p-4 space-y-3.5 max-h-[420px] overflow-y-auto bg-slate-50/50">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-6 px-4 space-y-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          歡迎向 GPT-6 Luna 智庫顧問提問！
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          導讀後仍有不甚清楚或想深入探討之處？您可以直接點選下列常見提問，或在下方輸入框提出任何問題：
                        </p>
                      </div>

                      {/* 預設建議問題按鈕 */}
                      <div className="flex flex-wrap gap-1.5 justify-center max-w-lg mx-auto pt-2">
                        {[
                          `💡 這份${typeConfig.label}對智慧製造與專案實務有何核心啟發？`,
                          '💡 導入或落實此概念時，常見風險與阻礙是什麼？',
                          '💡 作為專案經理 (PM)，研習後可落地的 3 項具體行動方案？',
                          '💡 請針對本內容的核心重點為我進一步深入解讀',
                        ].map((prompt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendQuestion(prompt.replace(/^[💡\s]+/, ''))}
                            disabled={isAsking}
                            className="text-[11px] bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 hover:border-purple-300 rounded-lg px-2.5 py-1.5 text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98"
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
                        className={`flex gap-2.5 ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                            msg.role === 'user'
                              ? 'bg-linear-to-br from-indigo-600 to-purple-600 text-white rounded-tr-xs'
                              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs space-y-1.5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1">
                            <span className="font-semibold">
                              {msg.role === 'user' ? '您' : 'GPT-6 Luna 智庫顧問'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {msg.model && (
                                <span className="font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded text-[9px]">
                                  {msg.model}
                                </span>
                              )}
                              <span>{msg.createdAt}</span>
                            </div>
                          </div>

                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose prose-xs max-w-none text-slate-800 prose-headings:text-indigo-950 prose-headings:font-bold prose-headings:my-1.5 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-purple-900">
                              <MarkdownPreview content={msg.content} />
                            </div>
                          )}

                          {msg.role === 'assistant' && (
                            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSaveAnswerToNotes(msg, idx)}
                                disabled={savingNoteIndex === idx}
                                className={`text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-2xs ${
                                  savedNoteIndex === idx
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 hover:border-amber-300 active:scale-98'
                                }`}
                                title="將此問答與 AI 深入解析一鍵存入個人研讀心得筆記 (雲端永久保存)"
                              >
                                {savedNoteIndex === idx ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>已存入心得筆記</span>
                                  </>
                                ) : savingNoteIndex === idx ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                                    <span>儲存中...</span>
                                  </>
                                ) : (
                                  <>
                                    <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-600/30" />
                                    <span>📌 存入心得筆記</span>
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
                                className="text-[11px] text-slate-500 hover:text-purple-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-purple-50 transition-colors cursor-pointer"
                              >
                                {copiedIndex === idx ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-600 font-medium">已複製</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>複製回答</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 font-bold text-xs">
                            我
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* 等候回答狀態 */}
                  {isAsking && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-white border border-purple-200 text-slate-700 rounded-2xl rounded-tl-xs p-3 text-xs shadow-2xs flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                        <span className="font-medium text-purple-900">
                          GPT-6 Luna 正在研讀全文脈絡並深度思考回答中...
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* 底部輸入列 */}
                <div className="p-3 bg-white border-t border-purple-100 flex items-end gap-2">
                  <Textarea
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendQuestion();
                      }
                    }}
                    placeholder={`針對這份${typeConfig.label}提出疑問（例如：這個概念如何應用到專案現場？）... (Enter 送出)`}
                    rows={1}
                    className="min-h-[38px] max-h-[120px] text-xs resize-none bg-slate-50/70 border-purple-200 focus-visible:ring-purple-400 py-2"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isAsking || !questionInput.trim()}
                    onClick={() => handleSendQuestion()}
                    className="h-[38px] px-3.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                  >
                    {isAsking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>送出</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 研讀內容主體 (沉浸式 Markdown 閱讀) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {course.type === 'book'
                    ? '書籍核心重點、摘錄與反思 (Markdown)'
                    : course.type === 'video'
                    ? '影音重點精華與時間戳記筆記 (Markdown)'
                    : course.type === 'course'
                    ? '課程核心講義、大綱與研習重點 (Markdown)'
                    : '文章完整內文 (Markdown)'}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setShowNotesEditor((prev) => !prev)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{showNotesEditor ? '收合研讀心得' : '寫下研讀心得'}</span>
              </button>
            </div>

            {/* 個人研讀心得抽屜 */}
            {showNotesEditor && (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5 mb-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    ✍️ 我的實務研讀心得與反思 (Markdown)
                  </span>
                  <Button
                    size="sm"
                    disabled={isSavingNotes}
                    onClick={handleSavePersonalNotes}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingNotes ? '儲存中...' : '儲存心得'}</span>
                  </Button>
                </div>
                <Textarea
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="紀錄本內容對目前燁輝/億威專案的啟發，或您研讀後想嘗試採取的行動清單..."
                  rows={4}
                  className="text-xs bg-white border-amber-200 focus-visible:ring-amber-400"
                />
              </div>
            )}

            {mainMarkdown === '（尚未填寫內文）' ? (
              <div className="bg-slate-50/60 rounded-2xl p-8 border border-slate-200/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">尚未填寫重點內容或講義</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    您可以在編輯項目中填入{typeConfig.label}的核心大綱、摘要重點或筆記，填寫後即可直接在此進行 AI 導讀與針對內文的深入問答！
                  </p>
                </div>
                {onEdit && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      onEdit(course);
                    }}
                    className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>立即編輯補充重點</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/40 rounded-2xl p-6 md:p-10 border border-slate-200/80 shadow-2xs">
                <div className="max-w-4xl mx-auto leading-relaxed">
                  <MarkdownPreview content={mainMarkdown} readingMode={true} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部 Footer */}
        <div className="p-3.5 md:p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400 text-[11px]">
            億威電子 · PMO 專案知識與成長地圖
          </span>
          <Button size="sm" variant="outline" onClick={onClose} className="h-8">
            關閉閱讀
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
