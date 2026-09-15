'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
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
};

// A new component to handle the state and logic for the actions cell.
const ActionsCell: FC<{ user: User; onEdit: (user: User) => void }> = ({ user, onEdit }) => {
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>操作</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onEdit(user)}>
            編輯
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            刪除
          </DropdownMenuItem>
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
              此操作無法復原。將會永久刪除成員 "{user.displayName}"。
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
    </>
  );
};

export const columns = ({ onEdit }: ColumnsProps): ColumnDef<User>[] => [
  {
    accessorKey: 'username',
    header: '登入帳號',
    cell: ({ row }) => {
      const username = row.original.username || row.original.displayName || '';
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
      if (role === 'admin') {
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs border-amber-600 shadow-2xs">
            👑 管理者
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
      // Now the cell just renders the ActionsCell component, passing the necessary props.
      // All hook-related logic is self-contained within ActionsCell.
      return <ActionsCell user={user} onEdit={onEdit} />;
    },
  },
];
