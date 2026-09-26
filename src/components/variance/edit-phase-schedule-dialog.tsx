'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateProjectPhaseSchedules } from '@/lib/actions';
import { MAJOR_PHASES, MajorPhaseKey } from '@/lib/phase-constants';
import type { FullProject, ProjectPhaseSchedules } from '@/types';
import { Calendar, Wand2, Check } from 'lucide-react';

interface EditPhaseScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  onSuccess: (updatedSchedules: ProjectPhaseSchedules) => void;
}

export function EditPhaseScheduleDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: EditPhaseScheduleDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [project, open]);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-xl font-bold">
              設定專案四大階段規劃期程
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600">
            專案：<span className="font-semibold text-slate-800">[{project?.caseNumber}] {project?.name}</span>
            <br />
            為此專案的四大階段（設計、施工、驗證、驗收）設定預定起始與結束日期，系統將自動比對待辦事項實際進度進行差異分析。
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
          </div>

          <div className="space-y-3.5">
            {MAJOR_PHASES.map((p) => {
              const currentPhaseSched = schedules[p.key];
              return (
                <div
                  key={p.key}
                  className="p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
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
