'use client';

import { SubProjectWithLatestLog } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type TableViewProps = {
  groupedProjects: SubProjectWithLatestLog[][];
  onEditProject: (projectId: string) => void;
};

export function TableView({ groupedProjects, onEditProject }: TableViewProps) {
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return <span className="text-gray-400">進行中</span>;
    return format(new Date(dateString), 'yyyy/MM/dd');
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full border-collapse bg-white">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">主專案案號</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">主專案名稱</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">子專案名稱</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">負責人</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">預計完成日</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">實際完成日</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">本週執行摘要</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">下週工作計畫</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">遭遇問題及風險</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">總體完成度</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">操作</th>
          </tr>
        </thead>
        <tbody>
          {groupedProjects.flatMap((subProjects, projectIndex) =>
            subProjects.map((sp, subProjectIndex) => (
              <tr
                key={sp.id}
                className={cn(
                  'hover:bg-blue-50',
                  projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                )}
              >
                {subProjectIndex === 0 && (
                  <>
                    <td
                      rowSpan={subProjects.length}
                      className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top"
                    >
                      {sp.projectCaseNumber}
                    </td>
                    <td
                      rowSpan={subProjects.length}
                      className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top"
                    >
                      {sp.projectName}
                    </td>
                  </>
                )}
                <td className="border-b px-3 py-2 text-sm text-gray-800">{sp.name}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{sp.ownerName}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{formatDate(sp.expectedCompletionDate)}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{formatDate(sp.actualCompletionDate)}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{sp.latestLog?.executionSummary || <span className="text-gray-400">無</span>}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{sp.latestLog?.nextWeekPlan || <span className="text-gray-400">無</span>}</td>
                <td className="border-b px-3 py-2 text-sm">
                  {sp.latestLog?.roadblocks ? (
                    <span className="rounded bg-red-100 px-2 py-1 text-red-700">
                      {sp.latestLog.roadblocks}
                    </span>
                  ) : (
                    <span className="text-gray-400">無</span>
                  )}
                </td>
                <td className="border-b px-3 py-2 text-sm text-center text-gray-800">{sp.latestLog?.completionPercentage ?? 0}%</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">
                   <Button variant="ghost" size="icon" onClick={() => onEditProject(sp.projectId)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
