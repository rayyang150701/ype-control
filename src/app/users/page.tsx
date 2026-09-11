import { getUsers, getClients } from '@/lib/actions';
import { User } from '@/types';
import { UsersClient } from '@/components/users/client';

export const revalidate = 0;

export default async function UsersPage() {
  const [users, clients] = await Promise.all([
    getUsers(),
    getClients(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">成員管理</h1>
      <p className="text-muted-foreground">管理可以指派為專案負責人的使用者。</p>
      <UsersClient data={users as User[]} clients={clients} />
    </div>
  );
}
