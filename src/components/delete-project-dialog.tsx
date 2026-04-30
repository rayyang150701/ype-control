'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FullProject } from '@/types';

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FullProject | null;
  onConfirm: (projectId: string) => Promise<void>;
}

export function DeleteProjectDialog({
  open, onOpenChange, project, onConfirm,
}: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const canDelete = confirmText === '確認刪除';

  const handleDelete = async () => {
    if (!project || !canDelete) return;
    setLoading(true);
    try {
      await onConfirm(project.id);
      setConfirmText('');
      onOpenChange(false);
    } catch (error) {
      console.error('刪除專案失敗:', error);
      alert('刪除專案時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setConfirmText('');
    onOpenChange(v);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">⚠️ 刪除專案</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <span className="block">
              您確定要刪除以下專案嗎？此操作<strong className="text-destructive">無法復原</strong>。
            </span>
            <span className="block bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <strong>案號：</strong>{project.caseNumber}<br />
              <strong>名稱：</strong>{project.name}<br />
              <strong>子專案數：</strong>{project.subProjects?.length || 0} 個
              {project.subProjects?.length > 0 && (
                <span className="block mt-1 text-red-600">
                  ⚠️ 所有子專案及其歷史週報都會一併刪除！
                </span>
              )}
            </span>
            <span className="block text-sm">
              請輸入「<strong className="text-destructive">確認刪除</strong>」以繼續：
            </span>
          </DialogDescription>
        </DialogHeader>

        <Input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="確認刪除"
          className="mt-2"
          autoComplete="off"
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || loading}
          >
            {loading ? '刪除中...' : '永久刪除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
