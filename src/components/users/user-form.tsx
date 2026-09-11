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

const userSchema = z.object({
  displayName: z.string().min(1, '姓名為必填'),
  email: z.string().email('請輸入有效的 Email'),
  department: z.string().optional(),
  clientName: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer'], {
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
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const isEditMode = !!initialData;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: initialData
      ? {
          displayName: initialData.displayName,
          email: initialData.email,
          department: initialData.department || '',
          clientName: initialData.clientName || '燁輝',
          role: initialData.role,
          status: initialData.status,
        }
      : {
          displayName: '',
          email: '',
          department: '',
          clientName: '燁輝',
          role: 'viewer',
          status: 'active',
        },
  });

  const onSubmit = (data: UserFormData) => {
    startTransition(async () => {
      const result = isEditMode
        ? await updateUser(initialData.uid, data)
        : await createUser(data);

      if (result.success) {
        toast({ title: result.message });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? '編輯成員' : '新增成員'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? '修改成員的詳細資訊。' : '建立一位新成員。'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：王大明" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>客戶 (所屬單位)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || '燁輝'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇所屬客戶" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-48">
                        {clients.length > 0 ? (
                          clients.map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="燁輝">燁輝</SelectItem>
                        )}
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
                    <FormLabel>部門 (例如：PM、資訊部)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：PM、研發部、品管部"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇一個角色" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">管理員</SelectItem>
                      <SelectItem value="editor">編輯者</SelectItem>
                      <SelectItem value="viewer">檢視者</SelectItem>
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
                  <FormLabel>狀態</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇狀態" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">啟用</SelectItem>
                      <SelectItem value="pending">停用</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '儲存中...' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
