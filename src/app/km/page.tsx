import { getAllProjectsForInternal, getActionItems, getUsers, getClients } from '@/lib/actions';
import { KMClient } from '@/components/km/km-client';
import { Suspense } from 'react';

export const revalidate = 15;
export const maxDuration = 60;

export default async function KMPage() {
  const [projects, actionItems, users, clients] = await Promise.all([
    getAllProjectsForInternal(),
    getActionItems(),
    getUsers(),
    getClients(),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground font-medium">載入專案KM知識庫資料中...</div>}>
        <KMClient
          initialProjects={projects}
          initialActionItems={actionItems}
          users={users}
          clients={clients}
        />
      </Suspense>
    </div>
  );
}
