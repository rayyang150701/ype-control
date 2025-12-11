'use client';

import { useState, useTransition } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FullProject } from '@/types';
import { deleteProject } from '@/lib/actions';

const deleteSchema = z.object({
  projectId: z.string().min(1, '請選擇一個要刪除的專案'),
  confirmation: z.string(),
});

type DeleteFormData = z.infer<typeof deleteSchema>;

interface DeleteProjectDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  projects: FullProject[];
  onProjectDeleted: () => void;
}

export function DeleteProjectDialog({ isOpen, setIsOpen, projects, onProjectDeleted }: DeleteProjectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const form = useForm<DeleteFormData>({
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      projectId: '',
      confirmation: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const confirmationText = form.watch('confirmation');

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const isMatch = selectedProject ? confirmationText === selectedProject.caseNumber : false;

  const onSubmit = (data: DeleteFormData) => {
    if (!isMatch) {
      toast({
        title: '確認文字不符',
        description: '請輸入正確的專案案號以進行刪除。',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await deleteProject(data.projectId);
      if (result.success) {
        onProjectDeleted();
        form.reset();
      } else {
        toast({
          title: '刪除失敗',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除專案</DialogTitle>
          <DialogDescription>
            此操作無法復原，將會永久刪除所選專案及其所有相關的子專案和週報紀錄。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="projectId">選擇要刪除的專案</Label>
            <Select onValueChange={(value) => form.setValue('projectId', value)} defaultValue="">
                <SelectTrigger id="projectId">
                    <SelectValue placeholder="請選擇一個專案..." />
                </SelectTrigger>
                <SelectContent>
                {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                    {project.caseNumber} - {project.name}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
            {form.formState.errors.projectId && <p className="text-sm text-destructive">{form.formState.errors.projectId.message}</p>}
          </div>
          
          {selectedProject && (
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                為確認刪除，請輸入專案案號：
                <span className="font-bold text-destructive ml-1">{selectedProject.caseNumber}</span>
              </Label>
              <Input
                id="confirmation"
                {...form.register('confirmation')}
                autoComplete="off"
              />
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isMatch || isPending}
            >
              {isPending ? '刪除中...' : '確定刪除'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
