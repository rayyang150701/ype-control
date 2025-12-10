'use client';

import { useState } from 'react';
import { SubProjectWithLatestLog, FullProject } from '@/types';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type TableViewProps = {
  groupedProjects: FullProject[];
  onEditProject: (projectId: string) => void;
  onSubProjectClick: (subProject: SubProjectWithLatestLog) => void;
};

export function TableView({ groupedProjects, onEditProject, onSubProjectClick }: TableViewProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRowExpansion = (projectId: string) => {
    setExpandedRows(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };
  
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return <span className="text-gray-400">進行中</span>;
    return format(new Date(dateString), 'yyyy/MM/dd');
  };

  const getWeekRange = () => {
    const today = new Date();
    // Adjust to get Monday (if Sunday is 0, Monday is 1)
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when today is Sunday
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatShort = (date: Date) => {
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${m}/${d}`;
    };

    return `${formatShort(monday)} ~ ${formatShort(sunday)}`;
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full border-collapse bg-white">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">主專案案號</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">主專案名稱</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">專案目的</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">現況/問題點</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">燁輝專案負責主管與分機</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">TPM管理室窗口</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">億威電子</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">子專案名稱</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">負責人</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">預計完成日</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">實際完成日</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">本週執行摘要 ({getWeekRange()})</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">下週工作計畫</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">遭遇問題及風險</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">總體完成度</th>
            <th className="border-b bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700">操作</th>
          </tr>
        </thead>
        <tbody>
          {groupedProjects.map((project, projectIndex) =>
            project.subProjects.map((sp, subProjectIndex) => (
              <tr
                key={sp.id}
                className={cn(
                  'hover:bg-blue-50',
                  projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                )}
              >
                {subProjectIndex === 0 && (
                  <>
                    <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top">{project.caseNumber}</td>
                    <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top">{project.name}</td>
                    <td rowSpan={project.subProjects.length} title={project.projectPurpose} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top max-w-xs truncate cursor-help">{project.projectPurpose}</td>
                    <td rowSpan={project.subProjects.length} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top max-w-md">
                        <div className="space-y-1">
                            <p className={cn("text-sm", !expandedRows[project.id] && "line-clamp-2")}>
                                {project.currentStatusAndIssues}
                            </p>
                            {(project.currentStatusAndIssues?.length ?? 0) > 100 && (
                                <button
                                    className="text-blue-600 text-xs hover:underline"
                                    onClick={() => toggleRowExpansion(project.id)}
                                >
                                    {expandedRows[project.id] ? '收合' : '查看更多 →'}
                                </button>
                            )}
                        </div>
                    </td>
                    <td rowSpan={project.subProjects.length} title={project.yiehPhuiProjectManager} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top max-w-xs truncate cursor-help">{project.yiehPhuiProjectManager}</td>
                    <td rowSpan={project.subProjects.length} title={project.tpmOfficeContact} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top max-w-xs truncate cursor-help">{project.tpmOfficeContact}</td>
                    <td rowSpan={project.subProjects.length} title={project.egigaContact} className="border-b border-r px-3 py-2 text-sm text-gray-800 align-top max-w-xs truncate cursor-help">{project.egigaContact}</td>
                  </>
                )}
                <td className="border-b px-3 py-2 text-sm text-gray-800">
                   <button
                    type="button"
                    onClick={() => onSubProjectClick(sp)}
                    className="text-blue-600 underline hover:text-blue-800 bg-transparent border-none p-0 cursor-pointer text-left"
                  >
                    {sp.name}
                  </button>
                </td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{sp.ownerName}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{formatDate(sp.expectedCompletionDate)}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800">{formatDate(sp.actualCompletionDate)}</td>
                <td className="border-b px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap max-w-sm">
                    <p className="line-clamp-2 cursor-help" title={sp.latestLog?.executionSummary}>
                        {sp.latestLog?.executionSummary || <span className="text-gray-400">無</span>}
                    </p>
                </td>
                <td className="border-b px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap max-w-sm">
                    <p className="line-clamp-2 cursor-help" title={sp.latestLog?.nextWeekPlan}>
                        {sp.latestLog?.nextWeekPlan || <span className="text-gray-400">無</span>}
                    </p>
                </td>
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
