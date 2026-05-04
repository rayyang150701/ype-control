'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { addProgressLog } from '@/lib/actions';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { SubProjectWithLatestLog, ProgressLog } from '@/types';
import { CalendarIcon } from 'lucide-react';
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
  const { toast } = useToast();
  const { latestLog } = subProject;

  const {
    register,
    handleSubmit,
    reset,
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
  
  const getReportingPeriod = (date: Date) => {
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    const sunday = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(monday, 'yyyy/MM/dd')} - ${format(sunday, 'MM/dd')}`;
  };

  const reportingPeriod = useMemo(() => getReportingPeriod(selectedDate), [selectedDate]);

  const onSubmit = (data: LogFormData) => {
    startTransition(async () => {
      try {
        const newLogData = {
          ...data,
          roadblocks: data.roadblocks ?? '',
          reportingPeriod,
        };
  
        const newLog = await addProgressLog(subProject.projectId, subProject.id, newLogData);
        
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
      <DialogContent className="sm:max-w-[600px]">
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

            <div className="grid gap-2">
              <Label htmlFor="executionSummary">本週執行摘要 (自動帶入上週計畫)</Label>
              <Textarea id="executionSummary" {...register('executionSummary')} rows={4} />
              {errors.executionSummary && <p className="text-sm text-destructive">{errors.executionSummary.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nextWeekPlan">下週工作計畫</Label>
              <Textarea id="nextWeekPlan" {...register('nextWeekPlan')} rows={4} />
              {errors.nextWeekPlan && <p className="text-sm text-destructive">{errors.nextWeekPlan.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roadblocks">遭遇問題及風險</Label>
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
