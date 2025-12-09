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
import { User, FullProject } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { updateProject, getUsers } from '@/lib/actions';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';


const subProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().optional(),
  expectedCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

type EditProjectDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  project: FullProject;
  onProjectUpdated: () => void;
};

export function EditProjectDialog({ isOpen, setIsOpen, project, onProjectUpdated }: EditProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
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
      caseNumber: project.caseNumber,
      name: project.name,
      subProjects: project.subProjects.map(sp => ({
        id: sp.id,
        name: sp.name,
        owner: sp.owner,
        expectedCompletionDate: sp.expectedCompletionDate ? new Date(sp.expectedCompletionDate as string) : undefined,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProjects',
  });
  
  const originalSubProjectIds = project.subProjects.map(sp => sp.id);


  const onSubmit = (data: ProjectFormData) => {
    startTransition(async () => {
      const result = await updateProject(project.id, data, originalSubProjectIds);
      if (result.success) {
        toast({ title: result.message });
        onProjectUpdated();
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
            <DialogTitle className="font-headline text-xl">編輯專案</DialogTitle>
            <DialogDescription>修改主專案及其下的子專案資訊。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
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
                    </div>

                    {/* 預計完成日 */}
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
                                    {field.value ? format(field.value, "yyyy/MM/dd") : <span>選擇日期</span>}
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
                    </div>

                    {/* 刪除按鈕 */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-3 -right-3 h-7 w-7"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
          <DialogFooter className='pt-4'>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '儲存中...' : '儲存變更'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
