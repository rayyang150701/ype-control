'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const subProjectSchema = z.object({
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().min(1, '子專案負責人為必填'),
  expectedCompletionDate: z.date({ required_error: '預計完成日為必填' }),
});

const projectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

type NewProjectDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onProjectAdded: () => void;
  users: User[]; // Pass the list of users from the parent
};

export function NewProjectDialog({ isOpen, setIsOpen, onProjectAdded, users }: NewProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      caseNumber: '',
      name: '',
      subProjects: [{ name: '', owner: '', expectedCompletionDate: undefined }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProjects',
  });

  const onSubmit = (data: ProjectFormData) => {
    startTransition(async () => {
      // In a real app, you'd call a server action to save the project and sub-projects
      console.log('New project data (simulated):', data);
      toast({ title: '專案新增成功 (模擬)' });
      onProjectAdded();
      reset();
      setIsOpen(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">新增專案</DialogTitle>
            <DialogDescription>請填寫主專案及其下的子專案資訊。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="caseNumber">主專案案號</Label>
                <Input id="caseNumber" {...register('caseNumber')} />
                {errors.caseNumber && <p className="text-sm text-destructive">{errors.caseNumber.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">主專案名稱</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
            </div>
            
            <Separator />

            <div>
              <Label className="text-base font-medium">子專案列表</Label>
              <div className="mt-2 space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-x-4 gap-y-2 rounded-md border p-4 relative">
                    <div className="col-span-12 sm:col-span-4">
                      <Label>子專案名稱</Label>
                      <Input {...register(`subProjects.${index}.name`)} />
                      {errors.subProjects?.[index]?.name && (
                        <p className="text-sm text-destructive">{errors.subProjects?.[index]?.name?.message}</p>
                      )}
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <Label>負責人</Label>
                      <Controller
                        name={`subProjects.${index}.owner`}
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="選擇負責人" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* In a real app, `users` would be populated from props */}
                                    <SelectItem value="user-1">Alice</SelectItem>
                                    <SelectItem value="user-2">Bob</SelectItem>
                                    <SelectItem value="user-3">Charlie</SelectItem>
                                    <SelectItem value="user-4">David</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                      />
                       {errors.subProjects?.[index]?.owner && (
                        <p className="text-sm text-destructive">{errors.subProjects?.[index]?.owner?.message}</p>
                      )}
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                       <Label>預計完成日</Label>
                       <Controller
                        name={`subProjects.${index}.expectedCompletionDate`}
                        control={control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : <span>選擇日期</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                 <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                            </Popover>
                        )}
                      />
                       {errors.subProjects?.[index]?.expectedCompletionDate && (
                        <p className="text-sm text-destructive">{errors.subProjects?.[index]?.expectedCompletionDate?.message}</p>
                      )}
                    </div>
                    {fields.length > 1 && (
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute -top-3 -right-3 h-7 w-7"
                            onClick={() => remove(index)}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    )}
                  </div>
                ))}
                {errors.subProjects?.root && (
                     <p className="text-sm text-destructive">{errors.subProjects.root.message}</p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', owner: '', expectedCompletionDate: undefined })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  新增子專案
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>取消</Button>
            <Button type="submit" disabled={isPending}>{isPending ? '儲存中...' : '儲存專案'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
