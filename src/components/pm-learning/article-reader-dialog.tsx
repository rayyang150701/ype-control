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
} from 'lucide-react';
import { PMLearningCourse, CONTENT_TYPE_CONFIG } from '@/types/pm-learning';
import { MarkdownPreview } from './markdown-preview';
import { analyzeArticleContentAction, updatePMMemberProgress } from '@/lib/pm-learning-actions';
import { useToast } from '@/hooks/use-toast';

interface ArticleReaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  course: PMLearningCourse | null;
  currentUserId?: string;
  onEdit?: (course: PMLearningCourse) => void;
  onCourseUpdated?: (course: PMLearningCourse) => void;
}

export function ArticleReaderDialog({
  isOpen,
  onClose,
  course,
  currentUserId,
  onEdit,
  onCourseUpdated,
}: ArticleReaderDialogProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiCard, setShowAiCard] = useState(true);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // 初始化個人筆記
  React.useEffect(() => {
    if (course && currentUserId) {
      const prog = course.memberProgress[currentUserId];
      setPersonalNotes(prog?.notes || '');
    } else {
      setPersonalNotes('');
    }
  }, [course, currentUserId]);

  if (!course) return null;

  const typeConfig = CONTENT_TYPE_CONFIG[course.type || 'course'];
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

  // 儲存個人研讀筆記與心得
  const handleSavePersonalNotes = async () => {
    if (!currentUserId) {
      toast({ title: '請先登入後儲存心得', variant: 'destructive' });
      return;
    }
    setIsSavingNotes(true);
    try {
      const existingProg = course.memberProgress[currentUserId];
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
            ...course.memberProgress,
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
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
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

              {course.issueDate && (
                <Badge variant="outline" className="bg-indigo-50/70 text-indigo-700 border-indigo-200 font-mono">
                  <Calendar className="w-3 h-3 mr-1 text-indigo-500" />
                  {course.issueDate} 期
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

            <div className="flex items-center gap-2">
              {course.externalUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-slate-300 hover:border-slate-400 text-slate-700"
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
                  className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-900"
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
              <div className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">
                  {course.source || course.instructorOrPlatform}
                </span>
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
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    AI 重點導讀與專案落地分析
                    {course.aiAnalysis?.modelName && (
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {course.aiAnalysis.modelName}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    針對製造業排程、專案管理基線與跨部門協同提煉核心洞察
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAnalyzing}
                  onClick={handleTriggerAI}
                  className="h-8 text-xs font-semibold gap-1.5 border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 shadow-2xs"
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
                {course.aiAnalysis?.keyTakeaways && course.aiAnalysis.keyTakeaways.length > 0 && (
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
                {course.aiAnalysis?.actionableInsights && course.aiAnalysis.actionableInsights.length > 0 && (
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
          </div>

          {/* 文章內文主體 (沉浸式 Markdown 閱讀) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>文章完整內文 (Markdown)</span>
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
                  placeholder="紀錄本文對目前燁輝/億威專案的啟發，或您讀完後想嘗試採取的行動清單..."
                  rows={4}
                  className="text-xs bg-white border-amber-200 focus-visible:ring-amber-400"
                />
              </div>
            )}

            <div className="bg-slate-50/30 rounded-2xl p-4 md:p-6 border border-slate-100">
              <MarkdownPreview content={mainMarkdown} readingMode={true} />
            </div>
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
