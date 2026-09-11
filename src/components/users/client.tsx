'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/users/data-table';
import { columns } from '@/components/users/columns';
import { UserForm } from '@/components/users/user-form';
import { User, Client } from '@/types';
import { useAdmin } from '@/components/admin-context';
import { Users as UsersIcon } from 'lucide-react';

interface UsersClientProps {
  data: User[];
  clients?: Client[];
}

export function UsersClient({ data, clients = [] }: UsersClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { isAdmin, setIsLoginDialogOpen } = useAdmin();
  const router = useRouter();

  const handleOpenForm = (user: User | null = null) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    router.refresh();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-card rounded-xl border border-slate-200 shadow-xs max-w-lg mx-auto mt-8">
        <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-3">
          <UsersIcon className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">需要管理員權限</h2>
        <p className="text-xs text-muted-foreground mb-5 max-w-sm">
          「成員管理」為管理員專屬功能。請切換為管理員模式後再進行維護。
        </p>
        <Button onClick={() => setIsLoginDialogOpen(true)} className="gap-2 text-xs">
          管理員登入
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button onClick={() => handleOpenForm()}>
          <Plus className="mr-2 h-4 w-4" /> 新增成員
        </Button>
      </div>
      <DataTable
        columns={columns({ onEdit: handleOpenForm })}
        data={data}
        searchKey="displayName"
      />
      {isFormOpen && (
         <UserForm
            isOpen={isFormOpen}
            onClose={handleFormClose}
            initialData={selectedUser}
            clients={clients}
        />
      )}
    </>
  );
}
