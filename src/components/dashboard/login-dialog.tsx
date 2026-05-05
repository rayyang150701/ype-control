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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LockKeyhole } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLoginSuccess: () => void;
}

export function LoginDialog({ isOpen, setIsOpen, onLoginSuccess }: LoginDialogProps) {
  const { toast } = useToast();
  const [error, setError] = useState('');

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setError('');
    // 驗證指定帳號密碼
    if (data.username === 'admin' && data.password === 'emmt12345') {
      toast({
        title: '登入成功',
        description: '歡迎進入管理員模式',
      });
      onLoginSuccess();
      setIsOpen(false);
      form.reset();
    } else {
      setError('帳號或密碼錯誤，請重新輸入');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-headline text-2xl">管理員登入</DialogTitle>
          <DialogDescription className="text-center">
            請輸入管理員憑證以啟動編輯與管理功能。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>帳號</FormLabel>
                  <FormControl>
                    <Input placeholder="admin" {...field} />
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
              <p className="text-center text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full">
                立即登入
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
