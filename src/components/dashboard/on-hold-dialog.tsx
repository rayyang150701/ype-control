
'use client';

import { useState, useEffect, useTransition } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { setProjectOnHold } from '@/lib/actions';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CustomCalendar } from '@/components/shared/custom-calendar';
import { FullProject } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


const onHoldSchema = z.object({
  projectId: z.string().min(1, '請選擇一個主專案'),
  subProjectIds: z.array(z.string()).min(1, '請至少選擇一個子專案'),
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
  projects: FullProject[];
  onSuccess: () => void;
}

export function OnHoldDialog({
  isOpen,
  setIsOpen,
  projects,
  onSuccess,
}: OnHoldDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [openCalendar, setOpenCalendar] = useState<'startDate' | 'endDate' | null>(null);
  const { toast } = useToast();

  const form = useForm<OnHoldFormData>({
    resolver: zodResolver(onHoldSchema),
    defaultValues: {
      projectId: '',
      subProjectIds: [],
      reason: '',
      startDate: new Date(),
      notes: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    // Reset sub-project selection when parent project changes
    form.setValue('subProjectIds', []);
  }, [selectedProjectId, form]);

  const onSubmit = (data: OnHoldFormData) => {
    startTransition(async () => {
      try {
        const result = await setProjectOnHold(
          data.projectId,
          data.subProjectIds,
          {
            reason: data.reason,
            startDate: data.startDate,
            endDate: data.endDate,
            notes: data.notes,
          }
        );

        if (result.success) {
          toast({
            title: '設定成功',
            description: '專案/子專案已設為暫緩狀態',
          });
          setIsOpen(false);
          form.reset({ projectId: '', subProjectIds: [], reason: '', startDate: new Date(), notes: '' });
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

  const handleAllSubProjectsToggle = (checked: boolean) => {
    if (checked && selectedProject) {
        form.setValue('subProjectIds', selectedProject.subProjects.map(sp => sp.id));
    } else {
        form.setValue('subProjectIds', []);
    }
  };
  
  const formatDate = (date?: Date) => {
    if (!date) return '選擇日期';
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>設定專案/子專案暫緩</DialogTitle>
          <DialogDescription>
            選擇要暫緩的專案和子專案，並填寫相關資訊。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-4">
            
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>選擇主專案 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="請選擇一個主專案..." />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          {projects.map(project => (
                              <SelectItem key={project.id} value={project.id}>
                              {project.caseNumber} - {project.name}
                              </SelectItem>
                          ))}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
              )}
            />

            {selectedProject && (
              <div className="space-y-2">
                  <div className='flex justify-between items-center'>
                      <FormLabel>選擇要暫緩的子專案 *</FormLabel>
                      <div className="flex items-center space-x-2">
                          <Checkbox
                              id="selectAll"
                              onCheckedChange={(checked) => handleAllSubProjectsToggle(checked as boolean)}
                              checked={selectedProject.subProjects.length > 0 && form.watch('subProjectIds').length === selectedProject.subProjects.length}
                          />
                          <label
                              htmlFor="selectAll"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                              全選
                          </label>
                      </div>
                  </div>
                  <div className="rounded-md border p-4 grid grid-cols-2 gap-4">
                      {selectedProject.subProjects.map(subProject => (
                          <FormField
                              key={subProject.id}
                              control={form.control}
                              name="subProjectIds"
                              render={({ field }) => {
                                  return (
                                  <FormItem
                                      key={subProject.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                      <FormControl>
                                      <Checkbox
                                          checked={field.value?.includes(subProject.id)}
                                          onCheckedChange={(checked) => {
                                          return checked
                                              ? field.onChange([...field.value, subProject.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                  (value) => value !== subProject.id
                                                  )
                                              )
                                          }}
                                      />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                          {subProject.name}
                                      </FormLabel>
                                  </FormItem>
                                  )
                              }}
                          />
                      ))}
                  </div>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">提示: 若勾選所有子專案，將會將整個主專案標記為暫緩。</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>暫緩原因 *</FormLabel>
                  <FormControl>
                    <Input
                      id="reason"
                      placeholder="例如:客戶要求暫停、資源不足、等待審核等"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>暫緩開始日期 *</FormLabel>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpenCalendar(openCalendar === 'startDate' ? null : 'startDate')}
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          disabled={isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatDate(field.value)}
                        </Button>
                        {openCalendar === 'startDate' && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenCalendar(null)} />
                            <div className="absolute top-full left-0 mt-2 border rounded-md shadow-lg z-[101] bg-popover">
                              <CustomCalendar
                                selected={field.value}
                                onSelect={(date) => {
                                  field.onChange(date);
                                  setOpenCalendar(null);
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>預計恢復日期</FormLabel>
                       <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpenCalendar(openCalendar === 'endDate' ? null : 'endDate')}
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          disabled={isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? formatDate(field.value) : "選擇日期(可選)"}
                        </Button>
                        {openCalendar === 'endDate' && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenCalendar(null)} />
                            <div className="absolute top-full left-0 mt-2 border rounded-md shadow-lg z-[101] bg-popover">
                              <CustomCalendar
                                selected={field.value}
                                onSelect={(date) => {
                                  field.onChange(date);
                                  setOpenCalendar(null);
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea
                      id="notes"
                      placeholder="其他需要記錄的資訊..."
                      rows={3}
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
