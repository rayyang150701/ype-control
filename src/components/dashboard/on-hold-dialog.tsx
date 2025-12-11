'use client';

import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { setProjectOnHold } from '@/lib/actions';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CustomCalendar } from '@/components/shared/custom-calendar';

const onHoldSchema = z.object({
  reason: z.string().min(1, '請輸入暫緩原因'),
  startDate: z.date({
    required_error: '請選擇暫緩開始日期',
  }),
  endDate: z.date().optional(),
  notes: z.string().optional(),
});

type OnHoldFormData = z.infer<typeof onHoldSchema>;

interface OnHoldDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  projectId: string;
  subProjectId?: string;
  projectName: string;
  onSuccess: () => void;
}

export function OnHoldDialog({
  isOpen,
  setIsOpen,
  projectId,
  subProjectId,
  projectName,
  onSuccess,
}: OnHoldDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<OnHoldFormData>({
    resolver: zodResolver(onHoldSchema),
    defaultValues: {
      reason: '',
      startDate: new Date(),
      notes: '',
    },
  });

  const onSubmit = (data: OnHoldFormData) => {
    startTransition(async () => {
      try {
        const result = await setProjectOnHold(
          projectId, 
          {
            reason: data.reason,
            startDate: data.startDate,
            endDate: data.endDate,
            notes: data.notes,
          },
          subProjectId
        );

        if (result.success) {
          toast({
            title: '設定成功',
            description: '專案已設為暫緩狀態',
          });
          setIsOpen(false);
          form.reset({ reason: '', startDate: new Date(), notes: '' });
          onSuccess();
        } else {
          toast({
            title: '設定失敗',
            description: result.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('設定暫緩錯誤:', error);
        toast({
          title: '設定失敗',
          description: error instanceof Error ? error.message : '發生未知錯誤',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>設定專案暫緩</DialogTitle>
          <DialogDescription>
            目標:{' '}
            <span className="font-semibold text-foreground">{projectName}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="reason">暫緩原因 *</Label>
            <Input
              id="reason"
              {...form.register('reason')}
              placeholder="例如:客戶要求暫停、資源不足、等待審核等"
              disabled={isPending}
            />
            {form.formState.errors.reason && (
              <p className="text-sm text-destructive">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="startDate"
              control={form.control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>暫緩開始日期 *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, 'yyyy/MM/dd')
                        ) : (
                          <span>選擇日期</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CustomCalendar
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                      />
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.startDate && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              name="endDate"
              control={form.control}
              render={({ field }) => (
                 <div className="space-y-2">
                  <Label>預計恢復日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, 'yyyy/MM/dd')
                        ) : (
                          <span>選擇日期(可選)</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CustomCalendar
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                        disabled={(date) =>
                          form.watch('startDate')
                            ? date < form.watch('startDate')
                            : false
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="其他需要記錄的資訊..."
              rows={3}
              disabled={isPending}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  處理中...
                </>
              ) : (
                '確認暫緩'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
