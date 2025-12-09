'use client';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DeleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectName: string;
};

export function DeleteProjectDialog({
  open,
  onOpenChange,
  onConfirm,
  projectName,
}: DeleteProjectDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const isMatch = confirmationText === 'DELETE';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定要刪除專案嗎？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作無法復原。將會永久刪除專案 "{projectName}" 及其所有相關的子專案和週報紀錄。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="delete-confirm">
            請輸入 <span className="font-bold text-destructive">DELETE</span> 以確認
          </Label>
          <Input
            id="delete-confirm"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!isMatch}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            我確定要刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
