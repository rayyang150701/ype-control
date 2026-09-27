'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

interface MyLearningViewProps {
  courses: PMLearningCourse[];
  pmoMembers: User[];
  activeUserId: string;
  onActiveUserIdChange: (userId: string) => void;
  currentUser?: CurrentUser | null;
  categories?: string[];
  onOpenCategoryManager?: () => void;
  onCourseUpdated: (course: PMLearningCourse) => void;
  onOpenCreateDialog: (defaultUserId?: string) => void;
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
  const activeMember = pmoMembers.find((m) => m.uid === activeUserId) || pmoMembers[0];

  // 篩選指派給該成員的課程清單
  const myCourses = courses.filter((c) => c.assignedUserIds.includes(activeMember?.uid || ''));

  // 計算該成員個人的整體學習與時數數據
  const personalStats = useMemo(() => {
    if (myCourses.length === 0) {
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

      const prog = c.memberProgress[activeMember.uid];
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
    return [...myCourses].sort((a, b) => {
      const orderA = a.memberProgress[activeMember?.uid || '']?.sortOrder;
      const orderB = b.memberProgress[activeMember?.uid || '']?.sortOrder;
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

    // 立即更新前端各課程的 sortOrder 狀態
    newOrdered.forEach((c, idx) => {
      const existingProg = c.memberProgress[activeMember.uid] || {
        userId: activeMember.uid,
        userName: activeMember.displayName || '',
        progressPercent: 0,
        isCompleted: false,
        checklist: [],
        attachments: [],
      };
      onCourseUpdated({
        ...c,
        memberProgress: {
          ...c.memberProgress,
          [activeMember.uid]: {
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
      await saveUserCourseOrder(activeMember.uid, orderedIds);
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
              {pmoMembers.map((m) => (
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

      {/* 課程列表頂部工具列：說明與全部展開/收合開關 */}
      {sortedMyCourses.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span>已排定學習課程清單 ({sortedMyCourses.length} 門)</span>
            <span className="text-slate-400 font-normal hidden sm:inline">
              · 可使用 ▲ ▼ 調整個人上下排列順序，點選「展開詳情」編輯細節
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpandAllState((prev) => !prev)}
            className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1 font-semibold"
          >
            {expandAllState ? (
              <>
                <ChevronUp className="h-3 w-3" />
                <span>全部收合 ▴</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>全部展開 ▾</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* 個人課程卡片式呈現 (Card View，預設收起下層詳細內容，進度%與日期置於標題旁) */}
      <div className="space-y-4">
        {sortedMyCourses.map((course, idx) => (
          <PersonalCourseCard
            key={course.id}
            course={course}
            userId={activeMember.uid}
            currentUser={currentUser}
            isFirst={idx === 0}
            isLast={idx === sortedMyCourses.length - 1}
            defaultExpanded={expandAllState}
            onMoveCourse={(direction) => handleMoveCourse(course.id, direction)}
            onUpdateCourse={onCourseUpdated}
            onEditCourse={onEditCourse}
            onDeleteCourse={handleDeleteCourse}
          />
        ))}
      </div>
    </div>
  );
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

  // 控制整張卡片下半部是否展開（使用者要求紅框下預設收起）
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(defaultExpanded);

  useEffect(() => {
    setIsCardExpanded(defaultExpanded);
  }, [defaultExpanded]);

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

  // 同步外部變更
  useEffect(() => {
    setProgressVal(memberProgress.progressPercent || 0);
    setNotesText(memberProgress.notes || '');
    setChecklist(memberProgress.checklist || []);
    setAttachments(memberProgress.attachments || []);
  }, [memberProgress]);

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
              {/* 第一行：標題 + 分類 + 狀態 + 進度% + 日期 + 時數 */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg leading-snug">
                  {course.title}
                </span>

                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-medium shrink-0">
                  {course.category}
                </Badge>

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
                  {isFinished ? '✅ 已完訓' : progressVal > 0 ? `⚡ 修習中` : '📌 待啟動'}
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

                {/* 培訓時數 (明確放在名稱旁邊，並支援直接填寫/修改時數) */}
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

          {/* 右側操作群：傳送門 + 編輯 + 展開/收合切換按鈕 */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 self-start lg:self-center pl-7 lg:pl-0">
            {/* 外部傳送門按鈕 */}
            {course.externalUrl && (
              <a
                href={course.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all active:scale-95"
              >
                <span>🚀 外部傳送門</span>
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
                  title="主管理員 / 建立者：可調整此課程名稱、講師平台、傳送門與起訖日"
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
                  title="刪除此課程"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* 展開 / 收合詳情按鈕 (紅框下預設收起) */}
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
                <span className="font-semibold text-slate-700">培訓平台 / 講師：</span>
                <span className="text-indigo-600 font-bold">{course.instructorOrPlatform}</span>
              </div>
              {course.createdBy && (
                <div className="text-[11px] text-slate-400">
                  {course.createdBy === 'system' ? '（系統內建課程）' : '（成員自訂課程）'}
                </div>
              )}
            </div>
            {course.description && (
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {course.description}
              </p>
            )}
          </div>

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
                  {checklist.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        item.completed
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-500'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => handleToggleCheck(item.id)}
                        />
                        <span className="text-[11px] font-mono text-slate-400 font-medium">
                          {idx + 1}.
                        </span>
                        <span
                          className={
                            item.completed
                              ? 'line-through text-slate-400'
                              : 'font-semibold text-slate-800'
                          }
                        >
                          {item.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckItem(item.id)}
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
      )}
    </div>
  );
}
