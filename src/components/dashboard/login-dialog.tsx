'use client';

import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LockKeyhole, Loader2 } from 'lucide-react';
import { useAdmin } from '@/components/admin-context';
import { loginUser } from '@/lib/actions';

const loginSchema = z.object({
  account: z.string().min(1, '請輸入帳號或電子郵件'),
  password: z.string().min(1, '請輸入密碼'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLoginSuccess?: () => void;
}

export function LoginDialog({ isOpen, setIsOpen, onLoginSuccess }: LoginDialogProps) {
  const { toast } = useToast();
  const { login } = useAdmin();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);
    try {
      const res = await loginUser({
        accountOrEmail: data.account,
        password: data.password,
      });

      if (res.success && res.user) {
        login(res.user);
        const roleLabel =
          res.user.role === 'admin'
            ? '系統管理員'
            : res.user.role === 'editor'
            ? '進度管制編輯者'
            : '一般檢視者';

        toast({
          title: '登入成功',
          description: `歡迎回來，${res.user.displayName || res.user.username} (${roleLabel})`,
        });

        if (onLoginSuccess) {
          onLoginSuccess();
        }
        setIsOpen(false);
        form.reset();
      } else {
        setError(res.message || '帳號或密碼錯誤，請重新確認後再試。');
      }
    } catch (err: any) {
      setError(err?.message || '登入系統異常，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-headline text-2xl">系統身分登入</DialogTitle>
          <DialogDescription className="text-center">
            請輸入帳號或電子郵件登入，以依身分權限進行操作。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="account"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>帳號或電子郵件</FormLabel>
                  <FormControl>
                    <Input placeholder="admin 或 使用者帳號 / Email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密碼</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {error && (
              <p className="text-center text-xs font-medium text-destructive bg-destructive/10 py-2 px-3 rounded-md border border-destructive/20">
                {error}
              </p>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登入中...
                  </>
                ) : (
                  '立即登入'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
