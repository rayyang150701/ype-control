import { getAllProjectsForInternal, getActionItems, getUsers, getClients } from '@/lib/actions';
import { InternalTasksClient } from '@/components/internal/internal-tasks-client';
import { Suspense } from 'react';

export const revalidate = 0;
export const maxDuration = 60;

export default async function InternalTasksPage() {
  const [projects, actionItems, users, clients] = await Promise.all([
    getAllProjectsForInternal(),
    getActionItems(),
    getUsers(),
    getClients(),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">載入內部專案待辦資料中...</div>}>
        <InternalTasksClient
          initialProjects={projects}
          initialActionItems={actionItems}
          users={users}
          clients={clients}
        />
      </Suspense>
    </div>
  );
}
