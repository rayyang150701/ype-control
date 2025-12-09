'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { useState, useTransition } from 'react';

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
import { useRouter } from 'next/navigation';

type ColumnsProps = {
  onEdit: (user: User) => void;
};

export const columns = ({ onEdit }: ColumnsProps): ColumnDef<User>[] => [
  {
    accessorKey: 'displayName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          姓名
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'role',
    header: '角色',
     cell: ({ row }) => {
      const role = row.original.role;
      const variant = role === 'admin' ? 'default' : 'secondary';
      const text = {
        admin: '管理員',
        editor: '編輯者',
        viewer: '檢視者',
      }[role];
      return <Badge variant={variant}>{text}</Badge>;
    },
  },
  {
    accessorKey: 'status',
    header: '狀態',
    cell: ({ row }) => {
      const status = row.original.status;
      const variant = status === 'active' ? 'secondary' : 'destructive';
       const text = {
        active: '啟用',
        pending: '停用',
      }[status];
      return <Badge variant={variant} className={status === 'active' ? 'bg-green-500/20 text-green-700' : ''}>{text}</Badge>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
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
    },
  },
];
