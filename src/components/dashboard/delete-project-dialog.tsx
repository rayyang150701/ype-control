
'use client';

import { useState, useTransition, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FullProject } from '@/types';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { ScrollArea } from '../ui/scroll-area';

const deleteSchema = z.object({
  projectId: z.string().min(1, '請選擇一個主專案'),
  subProjectIds: z.array(z.string()).min(1, '請至少選擇一個要刪除的子專案'),
});

type DeleteFormData = z.infer<typeof deleteSchema>;

interface DeleteProjectDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  projects: FullProject[];
  onProjectDeleted: () => void;
}

export function DeleteProjectDialog({ isOpen, setIsOpen, projects, onProjectDeleted }: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<DeleteFormData>({
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      projectId: '',
      subProjectIds: [],
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    form.reset({ projectId: selectedProjectId, subProjectIds: [] });
  }, [selectedProjectId, form]);

  const onSubmit = async (data: DeleteFormData) => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${data.projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subProjectIds: data.subProjectIds }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || '刪除請求失敗');
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: '刪除成功',
          description: result.message,
        });
        
        form.reset({ projectId: '', subProjectIds: [] });
        setIsOpen(false);
        onProjectDeleted();
      } else {
        toast({
          title: '刪除失敗',
          description: result.message || '刪除時發生錯誤',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      toast({
        title: '刪除失敗',
        description: error instanceof Error ? error.message : '無法連接到伺服器,請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      form.reset({ projectId: '', subProjectIds: [] });
      setIsOpen(false);
    }
  };

  const handleAllSubProjectsToggle = (checked: boolean) => {
    if (checked && selectedProject) {
        form.setValue('subProjectIds', selectedProject.subProjects.map(sp => sp.id));
    } else {
        form.setValue('subProjectIds', []);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除專案 / 子專案</DialogTitle>
          <DialogDescription>
            此操作無法復原。選擇一個主專案，然後勾選要永久刪除的子專案。若該主專案下的所有子專案皆被刪除，主專案本身也會被一併刪除。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>1. 選擇主專案</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isDeleting}>
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
              <FormField
                control={form.control}
                name="subProjectIds"
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-2 flex items-center justify-between">
                        <FormLabel>2. 選擇要刪除的子專案</FormLabel>
                        <div className="flex items-center space-x-2 pr-1">
                            <Checkbox
                                id="selectAll"
                                onCheckedChange={(checked) => handleAllSubProjectsToggle(checked as boolean)}
                                checked={selectedProject.subProjects.length > 0 && form.watch('subProjectIds').length === selectedProject.subProjects.length}
                                disabled={isDeleting}
                            />
                            <label htmlFor="selectAll" className="text-sm font-medium leading-none">全選</label>
                        </div>
                    </div>
                    <ScrollArea className="h-40 rounded-md border">
                        <div className="p-4 space-y-2">
                        {selectedProject.subProjects.map(subProject => (
                            <FormField
                                key={subProject.id}
                                control={form.control}
                                name="subProjectIds"
                                render={({ field }) => (
                                    <FormItem
                                        key={subProject.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(subProject.id)}
                                            onCheckedChange={(checked) => {
                                                const newValue = checked
                                                    ? [...field.value, subProject.id]
                                                    : field.value?.filter(id => id !== subProject.id);
                                                field.onChange(newValue);
                                            }}
                                            disabled={isDeleting}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">{subProject.name}</FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                        </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isDeleting && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在刪除中，這可能需要一些時間...
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleClose}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeleting || (form.watch('subProjectIds')?.length || 0) === 0}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    刪除中...
                  </>
                ) : (
                  '確認刪除'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
