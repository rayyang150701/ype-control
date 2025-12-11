
'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, PlusCircle, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, FullProject, SubProjectWithLatestLog } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { updateProject, getUsers, resumeProject, getFullProjectById } from '@/lib/actions';
import { CustomCalendar } from '@/components/shared/custom-calendar';

const subProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().min(1, '必須選擇一位負責人'),
  expectedCompletionDate: z.date().optional(),
  actualCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  projectPurpose: z.string().optional(),
  currentStatusAndIssues: z.string().optional(),
  yiehPhuiProjectManager: z.string().optional(),
  tpmOfficeContact: z.string().optional(),
  egigaContact: z.string().optional(),
  subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

type EditProjectDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  project: FullProject;
  onProjectUpdated: (updatedProject: FullProject) => void;
};

export function EditProjectDialog({ isOpen, setIsOpen, project, onProjectUpdated }: EditProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [openCalendar, setOpenCalendar] = useState<{ type: 'expected' | 'actual', index: number} | null>(null);
  
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    getValues
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      caseNumber: '',
      name: '',
      projectPurpose: '',
      currentStatusAndIssues: '',
      yiehPhuiProjectManager: '',
      tpmOfficeContact: '',
      egigaContact: '',
      subProjects: [],
    }
  });

  useEffect(() => {
    if (isOpen && project) {
      reset({
        caseNumber: project.caseNumber,
        name: project.name,
        projectPurpose: project.projectPurpose ?? '',
        currentStatusAndIssues: project.currentStatusAndIssues ?? '',
        yiehPhuiProjectManager: project.yiehPhuiProjectManager ?? '',
        tpmOfficeContact: project.tpmOfficeContact ?? '',
        egigaContact: project.egigaContact ?? '',
        subProjects: project.subProjects.map(sp => ({
          id: sp.id,
          name: sp.name,
          owner: sp.owner,
          expectedCompletionDate: sp.expectedCompletionDate ? new Date(sp.expectedCompletionDate as string) : undefined,
          actualCompletionDate: sp.actualCompletionDate ? new Date(sp.actualCompletionDate as string) : undefined,
        })),
      });
    }
  }, [project, isOpen, reset]);


  useEffect(() => {
    async function fetchUsers() {
      const userList = await getUsers();
      setUsers(userList);
    }
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);


  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProjects',
  });
  
  const originalSubProjectIds = project.subProjects.map(sp => sp.id);

  const formatDate = (date?: Date) => {
    if (!date) return '選擇日期';
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };
  
  const handleResumeProject = (isParent: boolean, subProjectId?: string) => {
    startTransition(async () => {
      const result = await resumeProject(project.id, isParent ? undefined : subProjectId);
      if (result.success) {
        toast({
          title: '專案已恢復',
          description: isParent ? '主專案狀態已變更為進行中' : '子專案狀態已變更為進行中',
        });
        const updatedProject = await getFullProjectById(project.id);
        if (updatedProject) {
          onProjectUpdated(updatedProject);
        }
      } else {
        toast({
          title: '錯誤',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  const onSubmit = (data: ProjectFormData) => {
    startTransition(async () => {
      const result = await updateProject(project.id, data, originalSubProjectIds);
      if (result.success) {
        toast({ title: result.message });
        const updatedProject = await getFullProjectById(project.id);
        if (updatedProject) {
          onProjectUpdated(updatedProject);
        }
        setIsOpen(false);
      } else {
        toast({ title: '錯誤', description: result.message, variant: 'destructive' });
      }
    });
  };
  
  const handleCalendarOpen = (type: 'expected' | 'actual', index: number) => {
    if(openCalendar?.type === type && openCalendar?.index === index) {
      setOpenCalendar(null);
    } else {
      setOpenCalendar({ type, index });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">編輯專案</DialogTitle>
              <DialogDescription>修改主專案及其下的子專案資訊。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
              
              {/* 主專案資訊 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="caseNumber">主專案案號</Label>
                  <Input id="caseNumber" {...register('caseNumber')} />
                  {errors.caseNumber && <p className="text-sm text-destructive">{errors.caseNumber.message}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">主專案名稱</Label>
                  <div className="flex items-center gap-2">
                    <Input id="name" {...register('name')} />
                    {project.isOnHold && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleResumeProject(true)}>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            恢復主專案
                        </Button>
                    )}
                  </div>
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="grid gap-2 col-span-1 md:col-span-2">
                  <Label htmlFor="projectPurpose">專案目的</Label>
                  <Textarea id="projectPurpose" {...register('projectPurpose')} />
                </div>

                <div className="grid gap-2 col-span-1 md:col-span-2">
                  <Label htmlFor="currentStatusAndIssues">現況/問題點</Label>
                  <Textarea id="currentStatusAndIssues" {...register('currentStatusAndIssues')} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="yiehPhuiProjectManager">燁輝專案負責主管與分機</Label>
                  <Input id="yiehPhuiProjectManager" {...register('yiehPhuiProjectManager')} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tpmOfficeContact">TPM管理室窗口</Label>
                  <Input id="tpmOfficeContact" {...register('tpmOfficeContact')} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="egigaContact">億威電子</Label>
                  <Input id="egigaContact" {...register('egigaContact')} />
                </div>
              </div>

              <Separator />

              {/* 子專案列表 */}
              <div>
                <Label className="text-base font-medium">子專案列表</Label>
                <div className="mt-2 space-y-4">
                  {fields.map((field, index) => {
                    const subProject = project.subProjects.find(sp => sp.id === field.id);
                    const isSubProjectOnHold = subProject?.isOnHold ?? false;

                    return (
                      <div
                        key={field.id}
                        className={cn("grid grid-cols-12 gap-x-4 gap-y-2 rounded-md border p-4 relative", (isSubProjectOnHold || project.isOnHold) && "bg-amber-50 border-amber-200")}
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
                        <div className="col-span-12 sm:col-span-2">
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
                        <div className="col-span-6 sm:col-span-3">
                          <Label>預計完成日</Label>
                          <Controller
                            name={`subProjects.${index}.expectedCompletionDate`}
                            control={control}
                            render={({ field }) => (
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleCalendarOpen('expected', index)}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {formatDate(field.value)}
                                </Button>
                                {openCalendar?.type === 'expected' && openCalendar?.index === index && (
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
                            )}
                          />
                        </div>

                        {/* 實際完成日 */}
                        <div className="col-span-6 sm:col-span-3">
                          <Label>實際完成日</Label>
                          <Controller
                            name={`subProjects.${index}.actualCompletionDate`}
                            control={control}
                            render={({ field }) => (
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleCalendarOpen('actual', index)}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {formatDate(field.value)}
                                </Button>

                                {openCalendar?.type === 'actual' && openCalendar?.index === index && (
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
                            )}
                          />
                        </div>
                        {isSubProjectOnHold && (
                          <div className="col-span-12 flex items-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handleResumeProject(false, subProject?.id)}
                              disabled={isPending}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {isPending ? '恢復中...' : '恢復子專案'}
                            </Button>
                          </div>
                        )}
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
                    )
                  })}

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
                        actualCompletionDate: undefined,
                      })
                    }
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    新增子專案
                  </Button>
                  {errors.subProjects?.root && (
                      <p className="text-sm text-destructive">
                          {errors.subProjects.root.message}
                      </p>
                  )}
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
    </>
  );
}
