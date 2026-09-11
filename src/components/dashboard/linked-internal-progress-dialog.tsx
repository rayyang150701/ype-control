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
  Users
} from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { getLinkedInternalProjectDetails } from '@/lib/actions';
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

  useEffect(() => {
    if (open && internalProjectId) {
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

  const blockedCount = actionItems.filter((i) => i.status === 'blocked').length;
  const overdueCount = actionItems.filter((i) => {
    if (i.status === 'completed' || !i.dueDate) return false;
    return differenceInCalendarDays(new Date(), new Date(i.dueDate)) > 0;
  }).length;
  const completedCount = actionItems.filter((i) => i.status === 'completed').length;

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
                    ) : project.sourceType === '其他智慧製造專案' ? (
                      <Badge className="bg-teal-700 text-white text-[11px] px-2 py-0.5 shadow-2xs">
                        ⚙️ 其他智慧製造專案
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
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <span>內部階段與待辦事項 ({actionItems.length})</span>
                </h4>

                {actionItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-slate-50/40">
                    此內部專案尚未建立待辦歷程。
                  </div>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden bg-white">
                    {actionItems.map((item) => {
                      const isDone = item.status === 'completed';
                      const today = new Date();
                      const dueDateObj = item.dueDate ? new Date(item.dueDate) : null;
                      const diffDays = dueDateObj ? differenceInCalendarDays(today, dueDateObj) : 0;
                      const isOverdue = !isDone && dueDateObj && diffDays > 0;
                      const isUpcoming = !isDone && dueDateObj && diffDays >= -3 && diffDays <= 0;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 text-xs space-y-1.5 transition-colors ${
                            isDone ? 'opacity-70 bg-slate-50/50' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-semibold text-slate-900 text-sm ${
                                  isDone ? 'line-through text-slate-500' : ''
                                }`}
                              >
                                {item.title}
                              </span>
                              {getPhaseBadge(item.phase)}

                              {item.waitingOn && (
                                <Badge
                                  variant="destructive"
                                  className="gap-1 font-medium text-xs px-2 py-0.5 bg-rose-600 text-white shadow-xs"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  等候：{item.waitingOn}
                                </Badge>
                              )}

                              {item.owner && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                  <UserCheck className="h-3 w-3" />
                                  負責人: {item.owner}
                                </span>
                              )}
                            </div>

                            {/* 預計完成日 */}
                            {item.dueDate ? (
                              <div className="text-right text-[11px]">
                                <span className="text-muted-foreground flex items-center gap-1 justify-end">
                                  <Calendar className="h-3 w-3" />
                                  預計: {item.dueDate}
                                </span>
                                {isOverdue && (
                                  <span className="text-rose-600 font-bold block mt-0.5">
                                    🚨 已逾期 {diffDays} 天
                                  </span>
                                )}
                                {isUpcoming && (
                                  <span className="text-amber-600 font-semibold block mt-0.5">
                                    ⏳ 剩餘 {Math.abs(diffDays)} 天到期
                                  </span>
                                )}
                                {isDone && (
                                  <span className="text-emerald-600 font-medium block mt-0.5">
                                    ✅ 已完成
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">未設到期日</span>
                            )}
                          </div>

                          {/* 歷程說明 */}
                          {item.notes && (
                            <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/60 leading-relaxed">
                              <span className="font-medium text-slate-700">歷程說明：</span>
                              {item.notes}
                            </p>
                          )}

                          {/* Lesson Learnt */}
                          {item.lessonLearnt && (
                            <p className="text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200/80 leading-relaxed">
                              <span className="font-semibold text-amber-950">💡 經驗檢討 (Lesson Learnt)：</span>
                              {item.lessonLearnt}
                            </p>
                          )}
                        </div>
                      );
                    })}
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
