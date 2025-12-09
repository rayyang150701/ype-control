'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateProgressLog } from '@/lib/actions';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ProgressLog } from '@/types';

const logSchema = z.object({
  executionSummary: z.string().min(1, '本週摘要為必填'),
  nextWeekPlan: z.string().min(1, '下週計畫為必填'),
  roadblocks: z.string().optional(),
  completionPercentage: z.coerce.number().min(0).max(100, '進度需介於 0-100'),
});

type LogFormData = z.infer<typeof logSchema>;

type EditLogDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  subProjectId: string;
  log: ProgressLog;
  onLogUpdated: (updatedLog: ProgressLog) => void;
};

export function EditLogDialog({ isOpen, setIsOpen, subProjectId, log, onLogUpdated }: EditLogDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LogFormData>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      executionSummary: log.executionSummary,
      nextWeekPlan: log.nextWeekPlan,
      roadblocks: log.roadblocks,
      completionPercentage: log.completionPercentage,
    },
  });

  const onSubmit = (data: LogFormData) => {
    startTransition(async () => {
      try {
        const updatedLog = await updateProgressLog(log.id, subProjectId, {
            ...data,
            roadblocks: data.roadblocks ?? '',
        });
        
        onLogUpdated(updatedLog);
  
        toast({ title: '週報更新成功' });
        setIsOpen(false);
      } catch (e) {
        console.error(e);
        toast({ title: '錯誤', description: '更新週報失敗', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="font-headline">編輯週報</DialogTitle>
            <DialogDescription>提報區間: {log.reportingPeriod}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="executionSummary">本週執行摘要</Label>
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
            <Button type="submit" disabled={isPending}>{isPending ? '儲存中...' : '儲存變更'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
