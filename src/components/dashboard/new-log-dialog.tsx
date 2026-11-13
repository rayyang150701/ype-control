'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { addProgressLog, getProgressLogsForSubProject } from '@/lib/actions';
import { useAdmin } from '@/components/admin-context';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { CalendarIcon, ChevronDown, ChevronRight, History } from 'lucide-react';
import { CustomCalendar } from '@/components/shared/custom-calendar';
import { cn } from '@/lib/utils';

const logSchema = z.object({
  executionSummary: z.string().min(1, '本週摘要為必填'),
  nextWeekPlan: z.string().min(1, '下週計畫為必填'),
  roadblocks: z.string().optional(),
  completionPercentage: z.coerce.number().min(0).max(100, '進度需介於 0-100'),
});

type LogFormData = z.infer<typeof logSchema>;

type NewLogDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  subProject: SubProjectWithLatestLog;
  onLogAdded: (newLog: ProgressLog, subProjectId: string) => void;
};

export function NewLogDialog({ isOpen, setIsOpen, subProject, onLogAdded }: NewLogDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pastLogs, setPastLogs] = useState<ProgressLog[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [showLast, setShowLast] = useState(true);
  const { toast } = useToast();
  const { currentUser } = useAdmin();
  const { latestLog } = subProject;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LogFormData>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      executionSummary: '',
      nextWeekPlan: '',
      roadblocks: '',
      completionPercentage: latestLog?.completionPercentage ?? 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        executionSummary: latestLog?.nextWeekPlan ?? '',
        nextWeekPlan: '',
        roadblocks: '',
        completionPercentage: latestLog?.completionPercentage ?? 0,
      });
      setSelectedDate(new Date());
      setIsCalendarOpen(false);
    }
  }, [isOpen, latestLog, reset]);
  
  // 開啟時讀取該子專案的歷史週報，供「顯示上週」與「帶入上週」使用
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingPast(true);
    getProgressLogsForSubProject(subProject.projectId, subProject.id)
      .then((logs) => {
        if (cancelled) return;
        setPastLogs(logs);
        const last = logs[0];
        // 預設帶入：本週摘要 = 上週的「下週工作計畫」；完成度沿用上週
        if (last) {
          if (!getValues('executionSummary') && last.nextWeekPlan) setValue('executionSummary', last.nextWeekPlan);
          if (!Number(getValues('completionPercentage')) && last.completionPercentage) {
            setValue('completionPercentage', last.completionPercentage);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPastLogs([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPast(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subProject.id]);

  const getReportingPeriod = (date: Date) => {
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    const sunday = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
  };

  const reportingPeriod = useMemo(() => getReportingPeriod(selectedDate), [selectedDate]);

  // 「上週」= 最近一筆、且不是目前所選週別的週報
  const lastLog = useMemo(
    () => pastLogs.find((l) => l.reportingPeriod !== reportingPeriod) || null,
    [pastLogs, reportingPeriod]
  );

  const copyFromLast = (field: 'executionSummary' | 'nextWeekPlan' | 'roadblocks', source: 'executionSummary' | 'nextWeekPlan' | 'roadblocks') => {
    if (!lastLog) return;
    setValue(field, (lastLog as any)[source] || '', { shouldDirty: true, shouldValidate: true });
  };

  const copyAllFromLast = () => {
    if (!lastLog) return;
    setValue('executionSummary', lastLog.executionSummary || '', { shouldDirty: true, shouldValidate: true });
    setValue('nextWeekPlan', lastLog.nextWeekPlan || '', { shouldDirty: true, shouldValidate: true });
    setValue('roadblocks', lastLog.roadblocks || '', { shouldDirty: true });
    setValue('completionPercentage', lastLog.completionPercentage ?? 0, { shouldDirty: true });
    toast({ title: '已帶入上週內容', description: '請確認或修改後再儲存。' });
  };

  const onSubmit = (data: LogFormData) => {
    startTransition(async () => {
      try {
        const newLogData = {
          ...data,
          roadblocks: data.roadblocks ?? '',
          reportingPeriod,
        };

        const operator = currentUser ? {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.username || currentUser.email,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
        } : undefined;
  
        const newLog = await addProgressLog(subProject.projectId, subProject.id, newLogData, operator);
        
        onLogAdded(newLog, subProject.id);
  
        toast({ title: '週報新增成功' });
        setIsOpen(false);
      } catch (e) {

        console.error(e);
        toast({ title: '錯誤', description: '新增週報失敗', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">新增週報 - {subProject.name}</DialogTitle>
            <DialogDescription>請填寫本週進度，或選擇其他週別進行補報。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>提報週別</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportingPeriod}
                </Button>
                
                {isCalendarOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[110]" 
                      onClick={() => setIsCalendarOpen(false)} 
                    />
                    <div className="absolute top-full left-0 mt-2 border rounded-md shadow-lg z-[120] bg-popover overflow-hidden">
                      <CustomCalendar
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">點擊可選擇不同日期，系統會自動轉換為對應的提報週。</p>
            </div>

            {/* 上週內容（避免關掉視窗回外層確認） */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50">
              <button
                type="button"
                onClick={() => setShowLast((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-indigo-800"
              >
                <span className="flex items-center gap-1.5">
                  {showLast ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <History className="h-4 w-4" />
                  上週內容{lastLog ? `（${lastLog.reportingPeriod}｜完成度 ${lastLog.completionPercentage}%）` : ''}
                </span>
                <span className="text-xs font-normal text-indigo-600">{showLast ? '收合' : '顯示上週'}</span>
              </button>
              {showLast && (
                <div className="px-3 pb-3 space-y-2 text-xs text-slate-700">
                  {isLoadingPast ? (
                    <div className="text-slate-500">讀取上週內容中…</div>
                  ) : !lastLog ? (
                    <div className="text-slate-500">這個子專案還沒有先前的週報。</div>
                  ) : (
                    <>
                      <div>
                        <div className="font-semibold text-slate-600">上週執行摘要</div>
                        <div className="whitespace-pre-wrap rounded bg-white border border-slate-200 p-2 max-h-28 overflow-y-auto">{lastLog.executionSummary || '（無）'}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">上週訂的「下週工作計畫」（本週應檢核是否達成）</div>
                        <div className="whitespace-pre-wrap rounded bg-white border border-amber-200 p-2 max-h-28 overflow-y-auto">{lastLog.nextWeekPlan || '（無）'}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">上週遭遇問題及風險</div>
                        <div className="whitespace-pre-wrap rounded bg-white border border-slate-200 p-2 max-h-20 overflow-y-auto">{lastLog.roadblocks || '（無）'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyFromLast('executionSummary', 'nextWeekPlan')}>
                          上週計畫 → 本週摘要
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={copyAllFromLast}>
                          整份帶入上週內容
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="executionSummary">本週執行摘要 (自動帶入上週計畫)</Label>
                {lastLog && (
                  <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => copyFromLast('executionSummary', 'executionSummary')}>
                    帶入上週摘要
                  </button>
                )}
              </div>
              <Textarea id="executionSummary" {...register('executionSummary')} rows={4} />
              {errors.executionSummary && <p className="text-sm text-destructive">{errors.executionSummary.message}</p>}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="nextWeekPlan">下週工作計畫</Label>
                {lastLog && (
                  <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => copyFromLast('nextWeekPlan', 'nextWeekPlan')}>
                    帶入上週計畫
                  </button>
                )}
              </div>
              <Textarea id="nextWeekPlan" {...register('nextWeekPlan')} rows={4} />
              {errors.nextWeekPlan && <p className="text-sm text-destructive">{errors.nextWeekPlan.message}</p>}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="roadblocks">遭遇問題及風險</Label>
                {lastLog && (
                  <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => copyFromLast('roadblocks', 'roadblocks')}>
                    帶入上週問題
                  </button>
                )}
              </div>
              <Textarea id="roadblocks" {...register('roadblocks')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="completionPercentage">總體完成度 (%)</Label>
              <Input id="completionPercentage" type="number" {...register('completionPercentage')} />
              {errors.completionPercentage && <p className="text-sm text-destructive">{errors.completionPercentage.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>取消</Button>
            <Button type="submit" disabled={isPending}>{isPending ? '儲存中...' : '儲存週報'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
