import { getUsers, getClients } from '@/lib/actions';
import { getPMLearningCourses, getPMLearningCategories } from '@/lib/pm-learning-actions';
import { PMLearningClient } from '@/components/pm-learning/pm-learning-client';
import { Suspense } from 'react';

export const revalidate = 15;
export const maxDuration = 60;

export default async function PMLearningPage() {
  const [courses, users, clients, categories] = await Promise.all([
    getPMLearningCourses(),
    getUsers(),
    getClients(),
    getPMLearningCategories(),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground font-medium">載入 PM 學習地圖資料中...</div>}>
        <PMLearningClient
          initialCourses={courses}
          users={users}
          clients={clients}
          initialCategories={categories}
        />
      </Suspense>
    </div>
  );
}
