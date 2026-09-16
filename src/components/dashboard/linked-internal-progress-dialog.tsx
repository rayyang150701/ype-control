'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Calendar, 
  ExternalLink, 
  Layers,
  FolderGit2,
  Hourglass,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { getLinkedInternalProjectDetails, updateActionItem } from '@/lib/actions';
import { useAdmin } from '@/components/admin-context';
import { useToast } from '@/hooks/use-toast';
import type { FullProject, ProjectActionItem } from '@/types';
import Link from 'next/link';

interface LinkedInternalProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internalProjectId?: string;
}

export function LinkedInternalProgressDialog({
  open,
  onOpenChange,
  internalProjectId,
}: LinkedInternalProgressDialogProps) {
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<FullProject | null>(null);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>([]);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const { isAdmin } = useAdmin();
  const { toast } = useToast();

  useEffect(() => {
    if (open && internalProjectId) {
      setIsCompletedExpanded(false);
      setLoading(true);
      getLinkedInternalProjectDetails(internalProjectId)
        .then((res) => {
          if (res) {
            setProject(res.project);
            setActionItems(res.actionItems);
          } else {
            setProject(null);
            setActionItems([]);
          }
        })
        .catch((err) => {
          console.error('載入內部專案進度失敗:', err);
          setProject(null);
          setActionItems([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setProject(null);
      setActionItems([]);
    }
  }, [open, internalProjectId]);

  const handleQuickToggleComplete = async (item: ProjectActionItem) => {
    if (!isAdmin) {
      toast({
        title: '權限不足',
        description: '只有系統管理者才具備結案/勾選待辦事項的權限。',
        variant: 'destructive',
      });
      return;
    }
    const newStatus = item.status === 'completed' ? 'in_progress' : 'completed';
    const nowIso = new Date().toISOString();
    
    // 樂觀更新前端狀態
    setActionItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: newStatus,
              completedAt: newStatus === 'completed' ? nowIso : null,
            }
          : i
      )
    );

    try {
      const res = await updateActionItem(item.id, { status: newStatus });
      if (res.success) {
        toast({
          title: newStatus === 'completed' ? '已標記為結案！' : '已重新開啟待辦',
        });
      } else {
        throw new Error((res as any).message || '更新失敗');
      }
    } catch (err: any) {
      // 失敗復原
      setActionItems((prev) =>
        prev.map((i) => (i.id === item.id ? item : i))
      );
      toast({
        title: '狀態更新失敗',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case '評估階段':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">評估階段</Badge>;
      case '報價/設計':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">報價/設計</Badge>;
      case '簽呈核決':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">簽呈核決</Badge>;
      case '開發/施工':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">開發/施工</Badge>;
      case '驗證測試':
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-300 text-xs">驗證測試</Badge>;
      case '驗收結案':
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">驗收結案</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{phase}</Badge>;
    }
  };

  const getStatusBadge = () => {
    if (!project) return null;
    const cat = project.projectCategory || '已開案';
    const status = project.internalStatus || 'in_progress';

    if (status === 'completed') {
      return (
        <Badge className="bg-emerald-600 text-white gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          ✅ 已結案
        </Badge>
      );
    }
    if (status === 'terminated') {
      return (
        <Badge variant="destructive" className="bg-rose-700 text-white gap-1 text-xs">
          <AlertCircle className="h-3 w-3" />
          ⛔ 專案終止
        </Badge>
      );
    }

    if (cat === '評估案') {
      return (
        <Badge className="bg-purple-600 text-white gap-1 text-xs">
          <Clock className="h-3 w-3" />
          📝 評估中
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-600 text-white gap-1 text-xs">
        <Layers className="h-3 w-3" />
        🚀 執行中
      </Badge>
    );
  };

  const activeItems = actionItems.filter((i) => i.status !== 'completed');
  const completedItems = actionItems.filter((i) => i.status === 'completed');

  const blockedCount = actionItems.filter((i) => i.status === 'blocked').length;
  const overdueCount = actionItems.filter((i) => {
    if (i.status === 'completed' || !i.dueDate) return false;
    return differenceInCalendarDays(new Date(), new Date(i.dueDate)) > 0;
  }).length;
  const completedCount = completedItems.length;

  const renderActionItemRow = (item: ProjectActionItem) => {
    const isDone = item.status === 'completed';
    const isBlocked = item.status === 'blocked';
    const today = new Date();
    const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
    const diffDays = dueDateObj
      ? differenceInCalendarDays(today, dueDateObj)
      : 0;
    const isOverdue = !isDone && dueDateObj && diffDays > 0;
    const isUpcoming = !isDone && dueDateObj && diffDays >= -3 && diffDays <= 0;

    // 工期計算（自動，無需人工維護）
    const startedAtObj = item.startedAt ? new Date(item.startedAt) : null;
    const completedAtObj = item.completedAt ? new Date(item.completedAt) : null;
    const workDays = startedAtObj
      ? differenceInCalendarDays(isDone && completedAtObj ? completedAtObj : today, startedAtObj)
      : null;
    const delayCount = item.dueDateHistory?.length || 0;
    const delayTotalDays = item.originalDueDate && item.dueDate && item.originalDueDate !== item.dueDate
      ? differenceInCalendarDays(new Date(item.dueDate), new Date(item.originalDueDate))
      : 0;

    return (
      <div
        key={item.id}
        className={`py-3 px-3.5 first:pt-3 last:pb-3 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors ${
          isDone ? 'opacity-75 bg-slate-50/40' : 'hover:bg-slate-50/50'
        }`}
      >
        {/* 左側：完成核選鈕 + 標題 + 標籤 + 歷程 */}
        <div className="flex items-start gap-2.5 flex-1 w-full sm:w-auto">
          {/* 一鍵切換完成 (只有管理者才具備勾選結案權限) */}
          {isAdmin ? (
            <button
              onClick={() => handleQuickToggleComplete(item)}
              className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                isDone
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-slate-300 hover:border-slate-500 bg-white'
              }`}
              title={isDone ? '標記為未完成' : '標記為已完成'}
            >
              {isDone && <Check className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="mt-1 shrink-0">
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : isBlocked ? (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              ) : (
                <Hourglass className="h-4 w-4 text-slate-400" />
              )}
            </div>
          )}

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-semibold text-slate-900 ${
                  isDone ? 'line-through text-slate-500' : ''
                }`}
              >
                {item.title}
              </span>

              {/* 專案類別標籤 */}
              {item.projectCategory && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-medium ${
                    item.projectCategory === '評估案'
                      ? 'border-purple-300 text-purple-700 bg-purple-50/60'
                      : 'border-blue-300 text-blue-700 bg-blue-50/60'
                  }`}
                >
                  {item.projectCategory === '評估案' ? '📝 評估' : '🚀 開案'}
                </Badge>
              )}

              {getPhaseBadge(item.phase)}

              {/* 卡關等候提示 (未完成時紅色明顯標註；已完成時淺灰色顯示) */}
              {item.waitingOn && (
                <Badge
                  variant={isDone ? 'outline' : 'destructive'}
                  className={
                    isDone
                      ? 'gap-1 font-normal text-xs px-2 py-0.5 bg-slate-100 text-slate-500 border-slate-200 shadow-none'
                      : 'gap-1 font-medium text-xs px-2 py-0.5 bg-rose-600 text-white shadow-xs'
                  }
                >
                  {!isDone && <AlertCircle className="h-3 w-3" />}
                  等候：{item.waitingOn}
                </Badge>
              )}

              {/* 責任歸屬 (客戶/單位) */}
              {item.owner && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                  <UserCheck className="h-3 w-3" />
                  責任歸屬: {item.owner}
                </span>
              )}
            </div>

            {/* 歷程說明 (支援換行與上下滾動顯示) */}
            {item.notes && (
              <div className="text-xs text-slate-700 bg-slate-50/90 p-2.5 rounded-md border border-slate-200/80 leading-relaxed shadow-2xs">
                <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  <span>📝 歷程說明：</span>
                </div>
                <div className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto pr-1 text-slate-600 select-text">
                  {item.notes}
                </div>
              </div>
            )}

            {/* Lesson Learnt 經驗檢討 (支援換行與上下滾動顯示) */}
            {item.lessonLearnt && (
              <div className="text-xs text-amber-950 bg-amber-50/80 p-2.5 rounded-md border border-amber-200/80 leading-relaxed mt-2 shadow-2xs">
                <div className="font-semibold text-amber-950 mb-1 flex items-center gap-1">
                  <span>💡 經驗檢討 (Lesson Learnt)：</span>
                </div>
                <div className="whitespace-pre-wrap break-words max-h-40 overflow-y-auto pr-1 text-amber-900 select-text">
                  {item.lessonLearnt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側：預計完成日跟催燈號 + 工期 */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end self-end sm:self-center shrink-0">
          {/* 預計完成日與跟催燈號 */}
          {item.dueDate ? (
            <div className="text-right text-xs">
              <div className="flex items-center gap-1 text-muted-foreground justify-end">
                <Calendar className="h-3 w-3" />
                <span>預計: {item.dueDate}</span>
              </div>

              {isOverdue && (
                <span className="text-rose-600 font-bold text-[11px] block mt-0.5">
                  🚨 已逾期 {diffDays} 天 (請跟催！)
                </span>
              )}

              {isUpcoming && (
                <span className="text-amber-600 font-semibold text-[11px] block mt-0.5">
                  ⏳ 剩餘 {Math.abs(diffDays)} 天到期
                </span>
              )}

              {isDone && (
                <span className="text-emerald-600 font-medium text-[11px] block mt-0.5">
                  ✅ 已於 {item.completedAt ? item.completedAt.slice(0, 10) : '近期'} 完成
                </span>
              )}

              {/* 工期與延期資訊（系統自動計算） */}
              {workDays !== null && workDays >= 0 && (
                <span className={`text-[11px] block mt-0.5 font-medium ${isDone ? 'text-slate-500' : 'text-blue-600'}`}>
                  ⏱ {isDone ? `工期 ${workDays} 天` : `已執行 ${workDays} 天`}
                </span>
              )}
              {delayCount > 0 && (
                <span className="text-[11px] block mt-0.5 text-orange-600 font-medium">
                  📅 延期 {delayCount} 次{delayTotalDays > 0 ? ` (+${delayTotalDays}天)` : ''}
                </span>
              )}
            </div>
          ) : (
            <div className="text-right text-xs">
              <span className="text-muted-foreground">未設預計日</span>
              {workDays !== null && workDays >= 0 && (
                <span className={`text-[11px] block mt-0.5 font-medium ${isDone ? 'text-slate-500' : 'text-blue-600'}`}>
                  ⏱ {isDone ? `工期 ${workDays} 天` : `已執行 ${workDays} 天`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-slate-50/80">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              關聯內部專案即時進度
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            即時同步自「內部專案待辦歷程追蹤」，隨時查閱等候對象（Waiting on）與各階段執行細節。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Hourglass className="h-6 w-6 animate-spin text-slate-400" />
              <span>正在載入內部專案即時進度...</span>
            </div>
          ) : !project ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              未找到該內部專案資料，可能已被移除或尚未建立。
            </div>
          ) : (
            <>
              {/* 專案基本資料卡 */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {project.caseNumber && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {project.caseNumber}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900">{project.name}</h3>

                    {project.sourceType === '億威內部自建專案' ? (
                      <Badge className="bg-purple-700 text-white text-[11px] px-2 py-0.5 shadow-2xs">
                        🏭 億威自建
                      </Badge>
                    ) : (project.sourceType === '其他專案' || project.sourceType === '其他智慧製造專案') ? (
                      <Badge className="bg-teal-700 text-white text-[11px] px-2 py-0.5 shadow-2xs">
                        ⚙️ 其他專案
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-700 text-white text-[11px] px-2 py-0.5 shadow-2xs">
                        🏢 燁輝列管
                      </Badge>
                    )}

                    <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-[11px] px-2 py-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-500" />
                      客戶: {project.clientName || '燁輝'}
                    </Badge>

                    {getStatusBadge()}
                    {project.autoCompletedByClient && (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[11px]">
                        🏆 客戶管制表結案自動同步
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {project.expectedCompletionDate && (
                      <div className="text-xs text-slate-700 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        <span>目標完成: <strong>{project.expectedCompletionDate}</strong></span>
                      </div>
                    )}

                    {(project.responsiblePm || project.tpmOfficeContact) && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                        <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                        <span>PM: <strong>{project.responsiblePm || project.tpmOfficeContact}</strong></span>
                      </div>
                    )}

                    {(project.clientContact || project.yiehPhuiProjectManager) && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>窗口: <strong>{project.clientContact || project.yiehPhuiProjectManager}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {project.projectPurpose && (
                  <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 leading-relaxed">
                    <span className="font-semibold text-slate-700">專案目的說明：</span>
                    {project.projectPurpose}
                  </p>
                )}

                {/* 待辦事項統計 */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="p-2 bg-white rounded border text-center">
                    <div className="text-[11px] text-muted-foreground">待辦總數</div>
                    <div className="text-base font-bold text-slate-800">{actionItems.length}</div>
                  </div>
                  <div className="p-2 bg-rose-50/70 rounded border border-rose-200 text-center">
                    <div className="text-[11px] text-rose-700 font-medium">卡關等候</div>
                    <div className="text-base font-bold text-rose-600">{blockedCount}</div>
                  </div>
                  <div className="p-2 bg-amber-50/70 rounded border border-amber-200 text-center">
                    <div className="text-[11px] text-amber-700 font-medium">逾期需催</div>
                    <div className="text-base font-bold text-amber-700">{overdueCount}</div>
                  </div>
                  <div className="p-2 bg-emerald-50/70 rounded border border-emerald-200 text-center">
                    <div className="text-[11px] text-emerald-700 font-medium">已完結</div>
                    <div className="text-base font-bold text-emerald-700">{completedCount}</div>
                  </div>
                </div>
              </div>

              {/* 待辦歷程清單 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <span>內部階段與待辦事項 ({actionItems.length})</span>
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-slate-700">進行中: {activeItems.length}</span>
                    <span>•</span>
                    <span className="font-medium text-emerald-600">已結案: {completedItems.length}</span>
                  </div>
                </div>

                {actionItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-slate-50/40">
                    此內部專案尚未建立任何待辦或歷程項目。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 次層 1：未完成待辦事項 (置頂，條列呈現) */}
                    {activeItems.length === 0 ? (
                      <div className="py-3 px-4 text-center text-xs rounded-lg bg-slate-50 border border-slate-200/70 text-slate-500 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>目前無未完成事項，進行中之待辦皆已全數結清。</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden bg-white shadow-2xs">
                        {activeItems.map((item) => renderActionItemRow(item))}
                      </div>
                    )}

                    {/* 次層 2：已結案 / 已完成事項 (放最下面，支援點擊展開/收合縮小) */}
                    {completedItems.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setIsCompletedExpanded((prev) => !prev)}
                          className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 transition-colors cursor-pointer select-none shadow-2xs"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>已結案事項 ({completedItems.length} 項)</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                            {isCompletedExpanded ? '點擊收合' : '點擊展開查看'}
                            {isCompletedExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </span>
                        </button>

                        {isCompletedExpanded && (
                          <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200/80 bg-slate-50/60 overflow-hidden shadow-2xs">
                            {completedItems.map((item) => renderActionItemRow(item))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 flex items-center justify-between sm:justify-between">
          {project && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100"
            >
              <Link href={`/internal-tasks?highlight=${project.id}`} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                前往內部專案管制維護頁面 ↗
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
