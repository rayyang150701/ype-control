import { getAllProjectsForInternal, getActionItems, getUsers, getClients } from '@/lib/actions';
import { ProjectVarianceClient } from '@/components/variance/project-variance-client';
import { Suspense } from 'react';

export const revalidate = 15;
export const maxDuration = 60;

export default async function ProjectVariancePage() {
  const [projects, actionItems, users, clients] = await Promise.all([
    getAllProjectsForInternal(),
    getActionItems(),
    getUsers(),
    getClients(),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground font-medium">載入專案差異分析資料中...</div>}>
        <ProjectVarianceClient
          initialProjects={projects}
          initialActionItems={actionItems}
          users={users}
          clients={clients}
        />
      </Suspense>
    </div>
  );
}
