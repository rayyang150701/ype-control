import { Suspense } from 'react';
import {
  getBusinessTrips,
  getClients,
  getAllProjectsForInternal,
  getUsers,
  getHolidays,
} from '@/lib/actions';
import { SchedulesClient } from '@/components/schedules/schedules-client';

export const revalidate = 0;
export const maxDuration = 60;

export const metadata = {
  title: '出差與行程管理 - 燁輝專案進度管制總表',
  description: '智慧製造跨廠出差行程、現場調校、進度追蹤與國定假日行事曆',
};

export default async function SchedulesPage() {
  const [trips, clients, projects, users, holidays] = await Promise.all([
    getBusinessTrips(),
    getClients(),
    getAllProjectsForInternal(),
    getUsers(),
    getHolidays(),
  ]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl print:max-w-none print:w-full print:p-0 print:m-0">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">載入出差行程行事曆中...</p>
          </div>
        }
      >
        <SchedulesClient
          initialTrips={trips}
          initialClients={clients}
          initialProjects={projects}
          initialUsers={users}
          initialHolidays={holidays}
        />
      </Suspense>
    </div>
  );
}
