'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown, KeyRound } from 'lucide-react';
import { useState, useTransition, FC } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

import { User } from '@/types';
import { Badge } from '../ui/badge';
import { deleteUser } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

type ColumnsProps = {
  onEdit: (user: User) => void;
  onResetPassword?: (user: User) => void;
  isSuperAdmin?: boolean;
};

// A new component to handle the state and logic for the actions cell.
const ActionsCell: FC<{
  user: User;
  onEdit: (user: User) => void;
  onResetPassword?: (user: User) => void;
  isSuperAdmin?: boolean;
}> = ({ user, onEdit, onResetPassword, isSuperAdmin }) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteUser(user.uid);
      if (result.success) {
        toast({ title: '成員已刪除' });
        router.refresh();
      } else {
        toast({
          title: '刪除失敗',
          description: result.message,
          variant: 'destructive',
        });
      }
      setIsDeleteDialogOpen(false);
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* 只有主管理員可以設定/重設密碼 */}
      {isSuperAdmin && onResetPassword && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onResetPassword(user)}
          className="h-7 px-2 text-xs gap-1 border-amber-300 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:text-amber-950 font-medium shadow-2xs"
          title="由主管理員直接為該帳號設定或重設登入密碼"
        >
          <KeyRound className="h-3.5 w-3.5 text-amber-600" />
          <span>設定密碼</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-7 w-7 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>帳號操作</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onEdit(user)}>
            編輯成員資料
          </DropdownMenuItem>
          {isSuperAdmin && onResetPassword && (
            <DropdownMenuItem onClick={() => onResetPassword(user)}>
              <KeyRound className="mr-2 h-3.5 w-3.5 text-amber-600" />
              <span>設定登入密碼</span>
            </DropdownMenuItem>
          )}
          {/* 只有主管理員可以刪除帳號 */}
          {isSuperAdmin && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              刪除帳號
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除這位成員嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。將會永久刪除成員 "{user.displayName}" 及其登入權限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const columns = ({ onEdit, onResetPassword, isSuperAdmin }: ColumnsProps): ColumnDef<User>[] => [
  {
    accessorKey: 'username',
    header: '登入帳號 (Email)',
    cell: ({ row }) => {
      const username = row.original.username || row.original.email || row.original.displayName || '';
      return (
        <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {username}
        </span>
      );
    },
  },
  {
    accessorKey: 'displayName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="p-0 hover:bg-transparent font-semibold"
        >
          姓名
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'email',
    header: '電子郵件',
  },
  {
    accessorKey: 'clientName',
    header: '公司別',
    cell: ({ row }) => {
      const client = row.original.clientName;
      return client ? (
        <span className="font-medium text-slate-800">{client}</span>
      ) : (
        <span className="text-muted-foreground text-xs">未設定</span>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || value === 'all') return true;
      const rowVal = (row.getValue(id) as string) || '';
      return rowVal === value;
    },
  },
  {
    accessorKey: 'department',
    header: '部門別',
    cell: ({ row }) => {
      const dept = row.original.department;
      return dept ? (
        <Badge variant="outline" className="font-mono text-xs bg-slate-50">
          {dept}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">未設定</span>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || value === 'all') return true;
      const rowVal = (row.getValue(id) as string) || '';
      return rowVal === value;
    },
  },
  {
    accessorKey: 'role',
    header: '系統權限',
    cell: ({ row }) => {
      const role = row.original.role;
      if (role === 'super_admin') {
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs border-amber-700 shadow-2xs">
            👑 主管理員
          </Badge>
        );
      }
      if (role === 'admin') {
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs border-indigo-700 shadow-2xs">
            🛡️ 管理員
          </Badge>
        );
      }
      if (role === 'editor') {
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs border-blue-700 shadow-2xs">
            ✏️ 編輯者
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="text-slate-600 font-medium text-xs bg-slate-50">
          👁️ 檢視者
        </Badge>
      );
    },
  },
  {
    accessorKey: 'status',
    header: '帳號狀態',
    cell: ({ row }) => {
      const status = row.original.status;
      if (status === 'active') {
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-xs">
            啟用中
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 font-medium text-xs">
          已停用
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <ActionsCell
          user={user}
          onEdit={onEdit}
          onResetPassword={onResetPassword}
          isSuperAdmin={isSuperAdmin}
        />
      );
    },
  },
];
