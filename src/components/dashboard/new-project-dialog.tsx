'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { createProject } from '@/lib/actions';
import { getUsers } from '@/lib/data';


const subProjectSchema = z.object({
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().min(1, '子專案負責人為必填'),
  expectedCompletionDate: z.date().optional(),
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
  // users: User[]; // No longer needed as we fetch inside
};

// 自製日曆組件
function CustomCalendar({ 
  selected, 
  onSelect 
}: { 
  selected?: Date; 
  onSelect: (date: Date) => void;
}) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(selected?.getFullYear() || today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selected?.getMonth() || today.getMonth());

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  
  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    const weeks = [];
    let days = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
      if (days.length === 7) {
        weeks.push(days);
        days = [];
      }
    }
    
    if (days.length > 0) {
      while (days.length < 7) {
        days.push(null);
      }
      weeks.push(days);
    }
    
    return weeks;
  };

  const weeks = generateCalendar();

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="p-3 bg-white">
      {/* 月份導航 */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          ←
        </button>
        <div className="text-sm font-semibold">
          {currentYear} 年 {monthNames[currentMonth]}
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          →
        </button>
      </div>

      {/* 星期標題 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 日期網格 */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              const isSelected = selected && 
                day !== null &&
                selected.getDate() === day && 
                selected.getMonth() === currentMonth && 
                selected.getFullYear() === currentYear;
              
              const isToday = day !== null &&
                day === today.getDate() && 
                currentMonth === today.getMonth() && 
                currentYear === today.getFullYear();

              return (
                <button
                  key={dayIndex}
                  type="button"
                  onClick={() => {
                    if (day) {
                      onSelect(new Date(currentYear, currentMonth, day));
                    }
                  }}
                  disabled={!day}
                  className={cn(
                    "p-2 text-sm rounded-md transition-colors",
                    !day && "invisible",
                    day && !isSelected && "hover:bg-accent",
                    isSelected && "bg-primary text-primary-foreground font-semibold",
                    isToday && !isSelected && "border border-primary"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewProjectDialog({ isOpen, setIsOpen, onProjectAdded }: NewProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [openCalendarIndex, setOpenCalendarIndex] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    async function fetchUsers() {
      const userList = await getUsers();
      setUsers(userList);
    }
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

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
      subProjects: [
        { name: '', owner: '', expectedCompletionDate: undefined },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProjects',
  });

  const formatDate = (date?: Date) => {
    if (!date) return '選擇日期';
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const onSubmit = (data: ProjectFormData) => {
    startTransition(async () => {
      const result = await createProject(data);
      if (result.success) {
        toast({ title: result.message });
        onProjectAdded();
        reset();
        setIsOpen(false);
      } else {
        toast({ title: '錯誤', description: result.message, variant: 'destructive' });
      }
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
            {/* 主專案資訊 */}
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

            {/* 子專案列表 */}
            <div>
              <Label className="text-base font-medium">子專案列表</Label>
              <div className="mt-2 space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-12 gap-x-4 gap-y-2 rounded-md border p-4 relative"
                  >
                    {/* 子專案名稱 */}
                    <div className="col-span-12 sm:col-span-4">
                      <Label>子專案名稱</Label>
                      <Input {...register(`subProjects.${index}.name`)} />
                      {errors.subProjects?.[index]?.name && (
                        <p className="text-sm text-destructive">
                          {errors.subProjects?.[index]?.name?.message}
                        </p>
                      )}
                    </div>

                    {/* 負責人 */}
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
                              {users.map(user => (
                                <SelectItem key={user.uid} value={user.uid}>
                                  {user.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.subProjects?.[index]?.owner && (
                        <p className="text-sm text-destructive">
                          {errors.subProjects?.[index]?.owner?.message}
                        </p>
                      )}
                    </div>

                    {/* 預計完成日 */}
                    <div className="col-span-6 sm:col-span-4">
                      <Label>預計完成日</Label>
                      <Controller
                        name={`subProjects.${index}.expectedCompletionDate`}
                        control={control}
                        render={({ field }) => (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setOpenCalendarIndex(openCalendarIndex === index ? null : index);
                              }}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formatDate(field.value)}
                            </Button>

                            {/* 自製日曆彈出層 */}
                            {openCalendarIndex === index && (
                              <>
                                {/* 背景遮罩 */}
                                <div
                                  className="fixed inset-0 z-[100]"
                                  onClick={() => setOpenCalendarIndex(null)}
                                />
                                
                                {/* 日曆面板 */}
                                <div className="absolute top-full left-0 mt-2 border rounded-md shadow-lg z-[101] bg-popover">
                                  <CustomCalendar
                                    selected={field.value}
                                    onSelect={(date) => {
                                      field.onChange(date);
                                      setOpenCalendarIndex(null);
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      />
                      {errors.subProjects?.[index]?.expectedCompletionDate && (
                        <p className="text-sm text-destructive">
                          {errors.subProjects?.[index]?.expectedCompletionDate?.message}
                        </p>
                      )}
                    </div>

                    {/* 刪除按鈕 */}
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

                {/* 新增子專案按鈕 */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: '',
                      owner: '',
                      expectedCompletionDate: undefined,
                    })
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  新增子專案
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '儲存中...' : '儲存專案'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
