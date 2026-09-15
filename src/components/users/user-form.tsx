'use client';

import { useTransition } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole, UserStatus, Client } from '@/types';
import { createUser, updateUser } from '@/lib/actions';
import { useAdmin } from '@/components/admin-context';

const userSchema = z.object({
  username: z.string().optional(),
  displayName: z.string().min(1, '姓名為必填'),
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().optional(),
  department: z.string().min(1, '部門別為必填'),
  clientName: z.string().min(1, '公司別為必填'),
  role: z.enum(['super_admin', 'admin', 'editor', 'viewer'], {
    errorMap: () => ({ message: '請選擇一個角色' }),
  }),
  status: z.enum(['active', 'pending'], {
    errorMap: () => ({ message: '請選擇一個狀態' }),
  }),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: User | null;
  clients?: Client[];
}

export function UserForm({ isOpen, onClose, initialData, clients = [] }: UserFormProps) {
  const { isSuperAdmin } = useAdmin();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const isEditMode = !!initialData;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: initialData
      ? {
          username: initialData.username || initialData.email || initialData.displayName || '',
          displayName: initialData.displayName || '',
          email: initialData.email || '',
          password: '',
          department: initialData.department || '',
          clientName: initialData.clientName || '燁輝',
          role: initialData.role || 'viewer',
          status: initialData.status || 'active',
        }
      : {
          username: '',
          displayName: '',
          email: '',
          password: '',
          department: '',
          clientName: '燁輝',
          role: 'editor',
          status: 'active',
        },
  });

  const onSubmit = (data: UserFormData) => {
    // 密碼必填檢查 (僅主管理員可設定密碼)
    if (isSuperAdmin) {
      if (!isEditMode && (!data.password || data.password.trim().length < 6)) {
        form.setError('password', { message: '建立新帳號時密碼為必填，且至少需 6 個字元' });
        return;
      }
      if (isEditMode && data.password && data.password.trim().length < 6) {
        form.setError('password', { message: '如需重設密碼，至少需 6 個字元' });
        return;
      }
    }

    const finalUsername = data.username?.trim() || data.email.trim();

    startTransition(async () => {
      const result = isEditMode
        ? await updateUser(initialData.uid, {
            username: finalUsername,
            displayName: data.displayName.trim(),
            email: data.email.trim(),
            password: data.password?.trim() || undefined,
            department: data.department.trim(),
            clientName: data.clientName.trim(),
            role: data.role,
            status: data.status,
          })
        : await createUser({
            username: finalUsername,
            displayName: data.displayName.trim(),
            email: data.email.trim(),
            password: data.password!.trim(),
            department: data.department.trim(),
            clientName: data.clientName.trim(),
            role: data.role,
            status: data.status,
          });

      if (result.success) {
        toast({ title: '操作成功', description: result.message });
        onClose();
      } else {
        toast({
          title: '發生錯誤',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  // 組合預設與客戶選單清單
  const clientOptions = Array.from(
    new Set([
      '燁輝',
      '億威電子',
      ...(clients || []).map((c) => c.name),
    ].filter(Boolean))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditMode ? '編輯成員與權限' : '新增成員帳號 (管理者建立)'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? '修改成員基本資料、密碼重設或調整系統授權角色。'
              : '建立新使用者帳號並設定初始登入密碼、所屬公司與權限。'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 帳號與姓名 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>登入帳號 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="例如：user@emmt.com.tw" {...field} />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">統一使用 Email 作為登入帳號</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="例如：楊秉叡 (Ray)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 電子郵件與密碼 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電子郵件 (Email) <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@emmt.com.tw"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!isEditMode) {
                            form.setValue('username', e.target.value);
                          }
                        }}
                      />
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
                    <FormLabel className="flex items-center justify-between">
                      <span>
                        {isEditMode ? '重設密碼 (選填)' : '登入密碼'}
                        <span className="text-destructive">{!isEditMode && isSuperAdmin ? ' *' : ''}</span>
                      </span>
                      {!isSuperAdmin && (
                        <span className="text-[11px] text-amber-600 font-normal">僅主管理員可設密碼</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={
                          !isSuperAdmin
                            ? '僅主管理員可設定或重設密碼'
                            : isEditMode
                            ? '留空表示保留原密碼 (若需變更請填寫)'
                            : '請輸入初始密碼 (至少 6 碼)'
                        }
                        disabled={!isSuperAdmin}
                        className={!isSuperAdmin ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 公司別與部門別 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司別 <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || '燁輝'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇公司別" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-48">
                        {clientOptions.map((cName) => (
                          <SelectItem key={cName} value={cName}>
                            {cName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>部門別 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：PM、資訊處、品管部"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 角色權限與狀態 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>系統權限角色 <span className="text-destructive">*</span></span>
                      {!isSuperAdmin && (
                        <span className="text-[11px] text-amber-600 font-normal">僅主管理員可升降階</span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!isSuperAdmin}
                    >
                      <FormControl>
                        <SelectTrigger className={!isSuperAdmin ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''}>
                          <SelectValue placeholder="選擇一個角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isSuperAdmin && (
                          <SelectItem value="super_admin">👑 主管理員 (所有權限、含刪除帳號/升降階/設定密碼)</SelectItem>
                        )}
                        <SelectItem value="admin">🛡️ 管理員 (除刪除/升降階/設密碼外之所有權限)</SelectItem>
                        <SelectItem value="editor">✏️ 編輯者 (讀寫管制總表、檢視內部專案追蹤)</SelectItem>
                        <SelectItem value="viewer">👁️ 檢視者 (僅訪客唯讀)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>帳號狀態 <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇狀態" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">啟用</SelectItem>
                        <SelectItem value="pending">停用 (禁用登入)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '處理中...' : isEditMode ? '儲存變更' : '建立帳號'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
