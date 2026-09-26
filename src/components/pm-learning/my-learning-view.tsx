'use client';

import React, { useState } from 'react';
import { PMLearningCourse, PMLearningMemberProgress, PMLearningAttachment } from '@/types/pm-learning';
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
  Save,
  Paperclip,
  FileText,
  RotateCcw,
  CheckSquare,
  Calculator,
  ChevronDown,
  Layers,
  Link as LinkIcon,
} from 'lucide-react';
import { updatePMMemberProgress } from '@/lib/pm-learning-actions';
import { useToast } from '@/hooks/use-toast';
import { MarkdownPreview } from './markdown-preview';

interface MyLearningViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  activeUserId: string;
  onActiveUserIdChange: (userId: string) => void;
  currentUser?: CurrentUser | null;
  onCourseUpdated: (course: PMLearningCourse) => void;
}

export function MyLearningView({
  courses,
  pmoMembers,
  activeUserId,
  onActiveUserIdChange,
  currentUser,
  onCourseUpdated,
}: MyLearningViewProps) {
  // 目前選中的億威 PMO 成員
  const activeMember = pmoMembers.find((m) => m.uid === activeUserId) || pmoMembers[0];

  // 篩選指派給該成員的課程清單
  const myCourses = courses.filter((c) => c.assignedUserIds.includes(activeMember?.uid || ''));

  // 計算該成員個人的整體學習數據
  const personalStats = React.useMemo(() => {
    if (myCourses.length === 0) {
      return { total: 0, completed: 0, inProgress: 0, avgPercent: 0 };
    }
    let totalP = 0;
    let completedC = 0;
    let inProgressC = 0;

    myCourses.forEach((c) => {
      const prog = c.memberProgress[activeMember.uid];
      const p = prog?.progressPercent ?? 0;
      totalP += p;
      if (prog?.isCompleted || p >= 100) {
        completedC++;
      } else if (p > 0) {
        inProgressC++;
      }
    });

    return {
      total: myCourses.length,
      completed: completedC,
      inProgress: inProgressC,
      avgPercent: Math.round(totalP / myCourses.length),
    };
  }, [myCourses, activeMember]);

  return (
    <div className="space-y-6">
      {/* 頂部人員切換與身分識別區 (限定億威電子 PMO 部門) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-linear-to-tr from-indigo-600 to-blue-500 text-white font-bold text-lg flex items-center justify-center shadow-2xs">
            {(activeMember?.displayName || activeMember?.email || 'PM').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {activeMember?.displayName || activeMember?.email} 的個人工作區
              </h2>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                🏢 億威電子 · {activeMember?.department || 'PMO專案管理處'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              掌握個人指派之核心培訓進度、即時檢核待辦、整理研習心得筆記與成果附件。
            </p>
          </div>
        </div>

        {/* 人員切換下拉選單 */}
        <div className="flex items-center gap-2 self-stretch md:self-auto bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <UserIcon className="h-4 w-4 text-slate-500 ml-1.5" />
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">切換成員:</span>
          <select
            value={activeMember?.uid}
            onChange={(e) => onActiveUserIdChange(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {pmoMembers.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName || m.email} (億威 · {m.department || 'PM'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 個人成果指標列 (Personal KPI Bar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-slate-500">已指派課程</span>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{personalStats.total} 堂</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-blue-600">積極進行中</span>
          <div className="text-xl font-bold text-blue-600 mt-0.5">{personalStats.inProgress} 堂</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <span className="text-[11px] font-semibold text-emerald-600">已完訓結業</span>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">{personalStats.completed} 堂</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-600">個人總完訓率</span>
            <span className="text-xs font-bold text-indigo-700">{personalStats.avgPercent}%</span>
          </div>
          <Progress value={personalStats.avgPercent} className="h-2 mt-2 bg-indigo-100" />
        </div>
      </div>

      {/* 無課程提示 */}
      {myCourses.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">
            目前尚未指派課程給 {activeMember?.displayName || activeMember?.email}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            可切換至「主管 / 團隊視角 (Team View)」進行培訓課程指派。
          </p>
        </div>
      )}

      {/* 個人課程卡片式呈現 (Card View) */}
      <div className="space-y-6">
        {myCourses.map((course) => (
          <PersonalCourseCard
            key={course.id}
            course={course}
            userId={activeMember.uid}
            onUpdateCourse={onCourseUpdated}
          />
        ))}
      </div>
    </div>
  );
}

// 單堂課程的個人專屬卡片元件
function PersonalCourseCard({
  course,
  userId,
  onUpdateCourse,
}: {
  course: PMLearningCourse;
  userId: string;
  onUpdateCourse: (course: PMLearningCourse) => void;
}) {
  const { toast } = useToast();
  const memberProgress: PMLearningMemberProgress = course.memberProgress[userId] || {
    userId,
    userName: '成員',
    progressPercent: 0,
    isCompleted: false,
    notes: '',
    checklist: (course.defaultChecklist || []).map((item, idx) => ({
      id: `chk-${idx}`,
      title: item,
      completed: false,
    })),
    attachments: [],
  };

  const [progressVal, setProgressVal] = useState<number>(memberProgress.progressPercent || 0);
  const [isNotesEditing, setIsNotesEditing] = useState<boolean>(false);
  const [notesText, setNotesText] = useState<string>(memberProgress.notes || '');
  const [checklist, setChecklist] = useState(memberProgress.checklist || []);
  const [newCheckText, setNewCheckText] = useState<string>('');
  const [attachments, setAttachments] = useState<PMLearningAttachment[]>(
    memberProgress.attachments || []
  );
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 同步外部變更
  React.useEffect(() => {
    setProgressVal(memberProgress.progressPercent || 0);
    setNotesText(memberProgress.notes || '');
    setChecklist(memberProgress.checklist || []);
    setAttachments(memberProgress.attachments || []);
  }, [memberProgress]);

  // 更新個人進度至伺服器
  const saveProgressPatch = async (patch: Partial<PMLearningMemberProgress>) => {
    setIsSaving(true);
    try {
      const res = await updatePMMemberProgress(course.id, userId, patch);
      if (res.success && res.data) {
        const updatedCourse = {
          ...course,
          memberProgress: {
            ...course.memberProgress,
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
    // 自動將所有待辦檢核打勾
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

  // 依待辦檢核項自動換算 %
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
      title: '已依檢核項換算進度',
      description: `檢核完成 ${completedCount}/${checklist.length} 項，達成率換算為 ${calcPercent}%`,
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300">
      {/* 卡片頂部條 (Header) */}
      <div className="p-5 border-b border-slate-100 bg-linear-to-r from-white via-slate-50/50 to-indigo-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 text-lg">{course.title}</span>
              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                {course.category}
              </Badge>
              <Badge
                className={`text-xs ${
                  isFinished
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : progressVal > 0
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {isFinished ? '✅ 已完訓結業' : progressVal > 0 ? `⚡ 修習中 (${progressVal}%)` : '📌 待啟動'}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
              <div>
                <span className="font-medium text-slate-700">培訓平台 / 講師：</span>
                <span className="text-indigo-600 font-semibold">{course.instructorOrPlatform}</span>
              </div>

              {(course.startDate || course.endDate) && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {course.startDate || '未定'} ~ {course.endDate || '未定'}
                  </span>
                </div>
              )}
            </div>

            {course.description && (
              <p className="text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                {course.description}
              </p>
            )}
          </div>

          {/* 外部傳送門按鈕 (External Portal Button) */}
          <div className="shrink-0 flex items-center gap-2 self-start lg:self-center">
            {course.externalUrl ? (
              <a
                href={course.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
              >
                <span>🚀 開啟課程傳送門</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className="text-xs text-slate-400 italic bg-slate-100 px-3 py-1.5 rounded-lg">
                無外部連結
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
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
                title="根據待辦檢核勾選比率自動算出百分比"
              >
                <Calculator className="h-3 w-3" />
                <span>依檢核項換算</span>
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

        {/* 2. 待辦檢核 (Checklist) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-800">
                待辦檢核清單 (Checklist)
              </span>
              <Badge variant="outline" className="text-[10px]">
                {checklist.filter((c) => c.completed).length} / {checklist.length} 已達成
              </Badge>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                  item.completed
                    ? 'bg-emerald-50/50 border-emerald-200 text-slate-500'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => handleToggleCheck(item.id)}
                  />
                  <span className={item.completed ? 'line-through text-slate-400' : 'font-medium'}>
                    {item.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteCheckItem(item.id)}
                  className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                  title="刪除檢核項"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* 新增個人檢核項輸入框 */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCheckItem();
                  }
                }}
                placeholder="新增個人待辦檢核，例如：「看完章節 1~3」、「繳交心得作業」、「實機測試」..."
                className="h-8 text-xs bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCheckItem}
                className="h-8 text-xs shrink-0 text-slate-700 gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>新增</span>
              </Button>
            </div>
          </div>
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

          {attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors"
                >
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 flex-1 min-w-0 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{att.title}</span>
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
    </div>
  );
}
