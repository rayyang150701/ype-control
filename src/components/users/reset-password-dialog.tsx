'use client';

import { useState, useTransition } from 'react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { resetUserPassword } from '@/lib/actions';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { User } from '@/types';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: User | null;
  onSuccess?: () => void;
}

export function ResetPasswordDialog({
  isOpen,
  setIsOpen,
  user,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.trim().length < 6) {
      setError('密碼長度至少需 6 個字元');
      return;
    }

    startTransition(async () => {
      const res = await resetUserPassword(user.uid, password.trim());
      if (res.success) {
        toast({
          title: '密碼設定成功',
          description: `成員「${user.displayName}」的登入密碼已成功更新！`,
        });
        setPassword('');
        setIsOpen(false);
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || '設定密碼失敗');
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-headline text-xl">
            設定 / 重設登入密碼
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            由主管理員直接為成員指定新的登入密碼。
          </DialogDescription>
        </DialogHeader>

        {/* 成員摘要資訊 */}
        <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1 text-slate-700">
          <div className="flex justify-between">
            <span className="text-muted-foreground">成員姓名：</span>
            <span className="font-semibold text-slate-900">{user.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">登入帳號：</span>
            <span className="font-mono font-medium text-slate-900">{user.username || user.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">電子郵件：</span>
            <span className="text-slate-900 truncate max-w-[200px]">{user.email}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-medium">
              新登入密碼 <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="請輸入新密碼 (至少 6 碼)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 text-sm font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              設定完成後，成員即可使用帳號/Email 及此密碼登入。
            </p>
          </div>

          {error && (
            <p className="text-xs font-medium text-destructive bg-destructive/10 py-1.5 px-3 rounded-md border border-destructive/20">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                '確認設定密碼'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
