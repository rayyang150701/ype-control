'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/users/data-table';
import { columns } from '@/components/users/columns';
import { UserForm } from '@/components/users/user-form';
import { ResetPasswordDialog } from '@/components/users/reset-password-dialog';
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
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedResetUser, setSelectedResetUser] = useState<User | null>(null);

  const { isAdmin, isSuperAdmin, setIsLoginDialogOpen } = useAdmin();
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

  const handleOpenResetPassword = (user: User) => {
    setSelectedResetUser(user);
    setIsResetPasswordOpen(true);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-xs">
          {isSuperAdmin ? (
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-medium inline-block">
              👑 您具有<strong>主管理員</strong>權限，可進行成員管理、升降階授權、設定登入密碼與刪除帳號。
            </span>
          ) : (
            <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md font-medium inline-block">
              🛡️ 您以<strong>管理員</strong>身分維護基本成員資料（升降階授權、密碼設定與刪除帳號由主管理員專責執行）。
            </span>
          )}
        </div>
        <Button onClick={() => handleOpenForm()} className="shadow-xs">
          <Plus className="mr-2 h-4 w-4" /> 新增成員
        </Button>
      </div>
      <DataTable
        columns={columns({
          onEdit: handleOpenForm,
          onResetPassword: handleOpenResetPassword,
          isSuperAdmin,
        })}
        data={data}
        searchKey="displayName"
        clients={clients}
      />
      {isFormOpen && (
        <UserForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          initialData={selectedUser}
          clients={clients}
        />
      )}
      {isResetPasswordOpen && selectedResetUser && (
        <ResetPasswordDialog
          isOpen={isResetPasswordOpen}
          setIsOpen={setIsResetPasswordOpen}
          user={selectedResetUser}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
