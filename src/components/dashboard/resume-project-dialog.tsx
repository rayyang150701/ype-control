
'use client';

import { useState, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { resumeProjects } from '@/lib/actions';
import { Loader2 } from 'lucide-react';
import { FullProject } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '../ui/scroll-area';

const resumeSchema = z.object({
  projects: z.array(z.string()),
  subProjects: z.record(z.array(z.string())),
});

type ResumeFormData = z.infer<typeof resumeSchema>;

interface ResumeProjectDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  projects: FullProject[];
  onSuccess: () => void;
}

export function ResumeProjectDialog({
  isOpen,
  setIsOpen,
  projects,
  onSuccess,
}: ResumeProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onHoldProjects = useMemo(() => {
    return projects
      .map(p => ({
        ...p,
        subProjects: p.subProjects.filter(sp => sp.isOnHold),
      }))
      .filter(p => p.isOnHold || p.subProjects.length > 0);
  }, [projects]);

  const form = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      projects: [],
      subProjects: {},
    },
  });
  
  const onSubmit = (data: ResumeFormData) => {
    const { projects: projectIds, subProjects: subProjectsByProject } = data;
    
    if (projectIds.length === 0 && Object.keys(subProjectsByProject).every(key => subProjectsByProject[key].length === 0)) {
        toast({
            title: "未選擇項目",
            description: "請至少選擇一個要恢復的專案或子專案",
            variant: "destructive",
        });
        return;
    }

    startTransition(async () => {
      try {
        const result = await resumeProjects(projectIds, subProjectsByProject);

        if (result.success) {
          toast({
            title: '設定成功',
            description: '所選的項目已恢復為進行中',
          });
          setIsOpen(false);
          form.reset({ projects: [], subProjects: {} });
          onSuccess();
        } else {
          toast({
            title: '設定失敗',
            description: result.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('恢復專案錯誤:', error);
        toast({
          title: '設定失敗',
          description: error instanceof Error ? error.message : '發生未知錯誤',
          variant: 'destructive',
        });
      }
    });
  };

  const handleParentProjectToggle = (projectId: string, isChecked: boolean, subProjectIds: string[]) => {
    form.setValue(
      'projects',
      isChecked ? [...form.watch('projects'), projectId] : form.watch('projects').filter(id => id !== projectId)
    );
    form.setValue('subProjects', { ...form.watch('subProjects'), [projectId]: [] });
  };
  
  const handleSubProjectToggle = (projectId: string, subProjectId: string, isChecked: boolean) => {
      const currentSubProjects = form.watch(`subProjects.${projectId}`) || [];
      const newSubProjects = isChecked 
          ? [...currentSubProjects, subProjectId]
          : currentSubProjects.filter(id => id !== subProjectId);
      form.setValue(`subProjects.${projectId}`, newSubProjects);

      // if a sub-project is checked, uncheck the parent
      if (isChecked && form.watch('projects').includes(projectId)) {
          form.setValue('projects', form.watch('projects').filter(id => id !== projectId));
      }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>恢復專案/子專案</DialogTitle>
          <DialogDescription>
            勾選您想要從「暫緩」狀態恢復為「進行中」的項目。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4 py-4">
              <div className="space-y-4">
                {onHoldProjects.length > 0 ? (
                  onHoldProjects.map(project => (
                    <div key={project.id} className="space-y-3 rounded-md border p-4">
                       <FormField
                          control={form.control}
                          name="projects"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-b pb-3">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(project.id)}
                                        onCheckedChange={(checked) => {
                                            handleParentProjectToggle(project.id, !!checked, project.subProjects.map(sp => sp.id))
                                        }}
                                        disabled={!project.isOnHold}
                                    />
                                </FormControl>
                                <FormLabel className="font-semibold text-base">
                                  {project.caseNumber} - {project.name} (主專案)
                                  {!project.isOnHold && <span className="text-sm font-normal text-muted-foreground ml-2">(僅其下的子專案可恢復)</span>}
                                </FormLabel>
                            </FormItem>
                          )}
                        />

                      <div className="pl-4 space-y-2">
                        {project.subProjects.map(subProject => (
                           <FormField
                            key={subProject.id}
                            control={form.control}
                            name={`subProjects.${project.id}`}
                            render={({ field: subProjectField }) => (
                                <FormItem
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                <FormControl>
                                    <Checkbox
                                        checked={subProjectField.value?.includes(subProject.id)}
                                        onCheckedChange={(checked) => {
                                            handleSubProjectToggle(project.id, subProject.id, !!checked)
                                        }}
                                        disabled={form.watch('projects').includes(project.id)}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">
                                    {subProject.name} (子專案)
                                </FormLabel>
                                </FormItem>
                            )}
                            />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">目前沒有任何暫緩中的專案或子專案。</p>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending || onHoldProjects.length === 0}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  '確認恢復'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
