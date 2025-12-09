import { getSubProjectsWithLatestLogs } from '@/lib/actions';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Suspense } from 'react';
import DashboardLoading from './loading';

export const revalidate = 0;

export default async function DashboardPage() {
  const subProjects = await getSubProjectsWithLatestLogs();

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardClient initialSubProjects={subProjects} />
    </Suspense>
  );
}
