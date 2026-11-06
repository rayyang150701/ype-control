'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateProjectPhaseSchedules, saveProjectWbs } from '@/lib/actions';
import { MAJOR_PHASES, MajorPhaseKey, DEFAULT_WBS_TEMPLATE } from '@/lib/phase-constants';
import type { FullProject, ProjectPhaseSchedules, WbsItem } from '@/types';
import { Calendar, Wand2, Check, Plus, Trash2, Lock } from 'lucide-react';

interface EditPhaseScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  onSuccess: (updatedSchedules: ProjectPhaseSchedules) => void;
  onWbsSaved?: (wbsItems: WbsItem[]) => void;
}

export function EditPhaseScheduleDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
  onWbsSaved,
}: EditPhaseScheduleDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wbsDraft, setWbsDraft] = useState<WbsItem[]>([]);
  const wbsLocked = !!project?.wbsBaselineLockedAt;

  // 四大階段起始與結束日期 state
  const [schedules, setSchedules] = useState<{
    design: { startDate: string; endDate: string };
    construction: { startDate: string; endDate: string };
    verification: { startDate: string; endDate: string };
    acceptance: { startDate: string; endDate: string };
  }>({
    design: { startDate: '', endDate: '' },
    construction: { startDate: '', endDate: '' },
    verification: { startDate: '', endDate: '' },
    acceptance: { startDate: '', endDate: '' },
  });

  useEffect(() => {
    if (project) {
      const ps = project.phaseSchedules || {};
      setSchedules({
        design: {
          startDate: ps.design?.startDate ? ps.design.startDate.slice(0, 10) : '',
          endDate: ps.design?.endDate ? ps.design.endDate.slice(0, 10) : '',
        },
        construction: {
          startDate: ps.construction?.startDate ? ps.construction.startDate.slice(0, 10) : '',
          endDate: ps.construction?.endDate ? ps.construction.endDate.slice(0, 10) : '',
        },
        verification: {
          startDate: ps.verification?.startDate ? ps.verification.startDate.slice(0, 10) : '',
          endDate: ps.verification?.endDate ? ps.verification.endDate.slice(0, 10) : '',
        },
        acceptance: {
          startDate: ps.acceptance?.startDate ? ps.acceptance.startDate.slice(0, 10) : '',
          endDate: ps.acceptance?.endDate ? ps.acceptance.endDate.slice(0, 10) : '',
        },
      });
    }
    setWbsDraft(project?.wbsItems ? project.wbsItems.map((w) => ({ ...w })) : []);
  }, [project, open]);

  const updateWbs = (id: string, patch: Partial<WbsItem>) =>
    setWbsDraft((d) => d.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const addWbs = (phaseKey: MajorPhaseKey) => {
    const ph = MAJOR_PHASES.find((x) => x.key === phaseKey)!;
    const count = wbsDraft.filter((w) => w.phaseKey === phaseKey).length;
    setWbsDraft((d) => [
      ...d,
      { id: `new_${Math.random().toString(36).slice(2, 10)}`, phaseKey, code: `${ph.code}.${count + 1}`, name: '新子階段', baselineStart: null, baselineEnd: null },
    ]);
  };

  const applyWbsTemplate = () => {
    setWbsDraft(
      DEFAULT_WBS_TEMPLATE.map((t) => ({
        id: `new_${Math.random().toString(36).slice(2, 10)}`,
        phaseKey: t.phaseKey,
        code: t.code,
        name: t.name,
        baselineStart: null,
        baselineEnd: null,
      }))
    );
  };

  // 依子階段起訖，帶入該階段的起訖範圍
  const fillPhaseFromWbs = (phaseKey: MajorPhaseKey) => {
    const list = wbsDraft.filter((w) => w.phaseKey === phaseKey && w.baselineStart && w.baselineEnd);
    if (list.length === 0) return;
    const start = list.map((w) => w.baselineStart as string).sort()[0];
    const end = list.map((w) => w.baselineEnd as string).sort().slice(-1)[0];
    setSchedules((prev) => ({ ...prev, [phaseKey]: { startDate: start.slice(0, 10), endDate: end.slice(0, 10) } }));
  };

  // 快捷排程範本 (依今年/指定年自動切分四大階段)
  const applyQuarterPreset = () => {
    const now = new Date();
    const curYear = now.getFullYear();
    setSchedules({
      design: {
        startDate: `${curYear}-06-01`,
        endDate: `${curYear}-07-31`,
      },
      construction: {
        startDate: `${curYear}-07-15`,
        endDate: `${curYear}-10-15`,
      },
      verification: {
        startDate: `${curYear}-10-16`,
        endDate: `${curYear}-11-15`,
      },
      acceptance: {
        startDate: `${curYear}-11-16`,
        endDate: `${curYear}-12-31`,
      },
    });
    toast({
      title: '已帶入標準季度排程範本',
      description: `已為 ${curYear} 年四大階段填入標準起訖期程，請確認後按儲存。`,
    });
  };

  const handleDateChange = (phaseKey: MajorPhaseKey, field: 'startDate' | 'endDate', val: string) => {
    setSchedules((prev) => ({
      ...prev,
      [phaseKey]: {
        ...prev[phaseKey],
        [field]: val,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setIsSubmitting(true);
    try {
      const payload: ProjectPhaseSchedules = {
        design: {
          startDate: schedules.design.startDate || null,
          endDate: schedules.design.endDate || null,
        },
        construction: {
          startDate: schedules.construction.startDate || null,
          endDate: schedules.construction.endDate || null,
        },
        verification: {
          startDate: schedules.verification.startDate || null,
          endDate: schedules.verification.endDate || null,
        },
        acceptance: {
          startDate: schedules.acceptance.startDate || null,
          endDate: schedules.acceptance.endDate || null,
        },
      };

      const res = await updateProjectPhaseSchedules(project.id, payload);
      if (res.success) {
        if (wbsDraft.length > 0 || (project.wbsItems && project.wbsItems.length > 0)) {
          const wres = await saveProjectWbs(
            project.id,
            wbsDraft.map((w) => (w.id.startsWith('new_') ? { ...w, id: '' } : w))
          );
          if (!wres.success) {
            toast({ title: '子階段儲存失敗', description: wres.message, variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          if (wres.data) onWbsSaved?.(wres.data.wbsItems);
        }
        toast({
          title: '四大階段規劃時程儲存成功',
          description: `專案「${project.name}」已更新四大階段規劃時程。`,
        });
        onSuccess(payload);
        onOpenChange(false);
      } else {
        toast({
          title: '儲存失敗',
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '儲存異常',
        description: err.message || '發生未預期的錯誤',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-xl font-bold">
              規劃專案時程（階段＋子階段）
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600">
            專案：<span className="font-semibold text-slate-800">[{project?.caseNumber}] {project?.name}</span>
            <br />
            先規劃四大階段的起訖日，再為各階段規劃子階段（第二階）的基準起訖日。專案待辦會依這裡的子階段選擇，Gap 圖以此比對延誤。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyQuarterPreset}
              className="text-xs flex items-center gap-1.5 border-dashed text-blue-700 hover:bg-blue-50"
            >
              <Wand2 className="h-3.5 w-3.5" />
              帶入標準季度排程範本
            </Button>
            {wbsDraft.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyWbsTemplate}
                className="ml-2 text-xs flex items-center gap-1.5 border-dashed text-indigo-700 hover:bg-indigo-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                套用預設子階段範本
              </Button>
            )}
          </div>

          <div className="space-y-3.5">
            {MAJOR_PHASES.map((p) => {
              const currentPhaseSched = schedules[p.key];
              return (
                <div
                  key={p.key}
                  className="p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/60 space-y-3"
                >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="sm:w-44 shrink-0">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-800" />
                      <span>{p.fullName}</span>
                    </div>
                    {p.subPhases.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        含：{p.subPhases.map((s) => s.name).join('、')}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-2.5 items-center">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">預定起始日期</Label>
                      <Input
                        type="date"
                        value={currentPhaseSched.startDate}
                        onChange={(e) => handleDateChange(p.key, 'startDate', e.target.value)}
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">預定結束日期</Label>
                      <Input
                        type="date"
                        value={currentPhaseSched.endDate}
                        onChange={(e) => handleDateChange(p.key, 'endDate', e.target.value)}
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 子階段（第二階） */}
                <div className="rounded-md bg-white border border-slate-200 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      子階段（第二階）
                      {wbsLocked && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
                          <Lock className="h-3 w-3" />基準已鎖定
                        </span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => fillPhaseFromWbs(p.key)}>
                        依子階段帶入階段起訖
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => addWbs(p.key)}>
                        <Plus className="h-3.5 w-3.5 mr-0.5" />新增子階段
                      </Button>
                    </div>
                  </div>
                  {wbsDraft.filter((w) => w.phaseKey === p.key).length === 0 && (
                    <div className="text-[11px] text-slate-400 py-1">尚無子階段。可按「新增子階段」，或在上方按「套用預設子階段範本」。</div>
                  )}
                  {wbsDraft.filter((w) => w.phaseKey === p.key).map((w) => (
                    <div key={w.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <Input className="col-span-2 h-8 text-xs" value={w.code} onChange={(e) => updateWbs(w.id, { code: e.target.value })} />
                      <Input className="col-span-5 h-8 text-xs" value={w.name} onChange={(e) => updateWbs(w.id, { name: e.target.value })} />
                      <Input
                        type="date"
                        className="col-span-2 h-8 text-xs"
                        disabled={wbsLocked && !w.id.startsWith('new_')}
                        value={w.baselineStart ? w.baselineStart.slice(0, 10) : ''}
                        onChange={(e) => updateWbs(w.id, { baselineStart: e.target.value || null })}
                      />
                      <Input
                        type="date"
                        className="col-span-2 h-8 text-xs"
                        disabled={wbsLocked && !w.id.startsWith('new_')}
                        value={w.baselineEnd ? w.baselineEnd.slice(0, 10) : ''}
                        onChange={(e) => updateWbs(w.id, { baselineEnd: e.target.value || null })}
                      />
                      <Button type="button" size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-red-500"
                        onClick={() => setWbsDraft((d) => d.filter((x) => x.id !== w.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <Check className="h-4 w-4 mr-1.5" />
              {isSubmitting ? '儲存中...' : '儲存規劃期程'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
