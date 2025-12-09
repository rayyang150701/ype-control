import { getSubProjectsWithLatestLogs } from '@/lib/actions';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Suspense } from 'react';
import DashboardLoading from './loading';

export const revalidate = 0;

export default async function DashboardPage() {
  const subProjects = await getSubProjectsWithLatestLogs();

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardClient initialSubProjects={subProjects} />
      </Suspense>
    </div>
  );
}
