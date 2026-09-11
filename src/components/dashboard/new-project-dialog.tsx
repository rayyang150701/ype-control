
'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, PlusCircle, Trash2, FolderGit2 } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { User, InternalProjectOption } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { createProject, getUsers, getInternalProjectsForDropdown } from '@/lib/actions';
import { CustomCalendar } from '@/components/shared/custom-calendar';


const subProjectSchema = z.object({
  name: z.string().min(1, '子專案名稱為必填'),
  owner: z.string().min(1, '必須選擇一位負責人'),
  expectedCompletionDate: z.date().optional(),
  actualCompletionDate: z.date().optional(),
});

const projectSchema = z.object({
  caseNumber: z.string().min(1, '主專案案號為必填'),
  name: z.string().min(1, '主專案名稱為必填'),
  linkedInternalProjectId: z.string().optional(),
  projectPurpose: z.string().optional(),
  currentStatusAndIssues: z.string().optional(),
  yiehPhuiProjectManager: z.string().optional(),
  tpmOfficeContact: z.string().optional(),
  egigaContact: z.string().optional(),
  subProjects: z.array(subProjectSchema).min(1, '至少需要一個子專案'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

type NewProjectDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onProjectAdded: () => void;
};

export function NewProjectDialog({ isOpen, setIsOpen, onProjectAdded }: NewProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [openCalendar, setOpenCalendar] = useState<{ type: 'expected' | 'actual', index: number} | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [internalProjects, setInternalProjects] = useState<InternalProjectOption[]>([]);

  useEffect(() => {
    async function fetchUsers() {
      const userList = await getUsers();
      setUsers(userList);
    }
    async function fetchInternalProjects() {
      const list = await getInternalProjectsForDropdown();
      setInternalProjects(list);
    }
    if (isOpen) {
      fetchUsers();
      fetchInternalProjects();
    }
  }, [isOpen]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      caseNumber: '',
      name: '',
      linkedInternalProjectId: '',
      projectPurpose: '',
      currentStatusAndIssues: '',
      yiehPhuiProjectManager: '',
      tpmOfficeContact: '',
      egigaContact: '',
      subProjects: [
        { name: '', owner: '', expectedCompletionDate: undefined, actualCompletionDate: undefined },
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
  
  const handleCalendarOpen = (type: 'expected' | 'actual', index: number) => {
    if(openCalendar?.type === type && openCalendar?.index === index) {
      setOpenCalendar(null);
    } else {
      setOpenCalendar({ type, index });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-4xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">新增專案</DialogTitle>
            <DialogDescription>請填寫主專案及其下的子專案資訊。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            {/* 連結內部專案 (選填) */}
            <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="linkedInternalProjectId" className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                  <FolderGit2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>連結內部專案 (選填，連動即時內部待辦歷程)</span>
                </Label>
                <span className="text-[11px] text-indigo-600">先內部評估後列管</span>
              </div>
              <Controller
                control={control}
                name="linkedInternalProjectId"
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(val) => {
                      const nextVal = val === 'none' ? '' : val;
                      field.onChange(nextVal);
                      if (nextVal) {
                        const selected = internalProjects.find(p => p.id === nextVal);
                        if (selected) {
                          if (selected.name) setValue('name', selected.name);
                          if (selected.tpmOfficeContact) setValue('tpmOfficeContact', selected.tpmOfficeContact);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white text-xs h-9 border-indigo-200">
                      <SelectValue placeholder="-- 請選擇欲關聯的內部專案 (或保持無連結) --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">無 (暫不連結內部專案)</SelectItem>
                      {internalProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-500">[{p.caseNumber}]</span>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">({p.category} · {p.internalStatus === 'completed' ? '已結案' : p.internalStatus === 'terminated' ? '已終止' : '進行中'})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                連結後，在管制總表中可直接點選「📋 內部待辦進度」參閱即時階段、等候對象（Waiting on）與跟催日；且當本案完工結案時，內部專案將自動轉換為已結案。
              </p>
            </div>

            {/* 主專案資訊 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => { setIsOpen(false); reset(); }}>
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
