'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/users/data-table';
import { columns } from '@/components/users/columns';
import { UserForm } from '@/components/users/user-form';
import { User } from '@/types';

interface UsersClientProps {
  data: User[];
}

export function UsersClient({ data }: UsersClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
        />
      )}
    </>
  );
}
