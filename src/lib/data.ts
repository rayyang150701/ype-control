import { subDays, addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { Project, SubProject, ProgressLog, User, SubProjectWithLatestLog } from '@/types';

const now = new Date();

const toTimestamp = (date: Date): Timestamp => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => date,
});

export const mockUsers: User[] = [
  { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com', role: 'editor', status: 'active', createdAt: toTimestamp(subDays(now, 20)) },
  { uid: 'user-2', displayName: 'Bob', email: 'bob@example.com', role: 'editor', status: 'active', createdAt: toTimestamp(subDays(now, 20)) },
  { uid: 'user-3', displayName: 'Charlie', email: 'charlie@example.com', role: 'admin', status: 'active', createdAt: toTimestamp(subDays(now, 30)) },
  { uid: 'user-4', displayName: 'David', email: 'david@example.com', role: 'viewer', status: 'active', createdAt: toTimestamp(subDays(now, 10)) },
];

const mockProjects: Project[] = [
  { id: 'proj-1', caseNumber: 'AY2501', name: '智慧工廠 MES 導入', status: 'active', createdAt: toTimestamp(subDays(now, 30)), createdBy: 'user-3' },
  { id: 'proj-2', caseNumber: 'AY2502', name: '供應鏈管理系統優化', status: 'active', createdAt: toTimestamp(subDays(now, 60)), createdBy: 'user-3' },
  { id: 'proj-3', caseNumber: 'AY2408', name: 'ERP 升級專案', status: 'completed', createdAt: toTimestamp(subDays(now, 180)), createdBy: 'user-3' },
];

const mockSubProjects: SubProject[] = [
  // Sub-projects for proj-1
  { id: 'sub-1-1', projectId: 'proj-1', name: '產線數據採集', owner: 'user-1', expectedCompletionDate: toTimestamp(addDays(now, 30)), createdAt: toTimestamp(subDays(now, 25)) },
  { id: 'sub-1-2', projectId: 'proj-1', name: '戰情室儀表板開發', owner: 'user-2', expectedCompletionDate: toTimestamp(addDays(now, 60)), createdAt: toTimestamp(subDays(now, 25)) },
  { id: 'sub-1-3', projectId: 'proj-1', name: 'AGV 系統整合', owner: 'user-1', expectedCompletionDate: toTimestamp(subDays(now, 5)), createdAt: toTimestamp(subDays(now, 25)) }, // Overdue project

  // Sub-projects for proj-2
  { id: 'sub-2-1', projectId: 'proj-2', name: '供應商評級模組', owner: 'user-2', expectedCompletionDate: toTimestamp(addDays(now, 45)), createdAt: toTimestamp(subDays(now, 50)) },
  
  // Sub-projects for proj-3
  { id: 'sub-3-1', projectId: 'proj-3', name: '財務模組上線', owner: 'user-1', expectedCompletionDate: toTimestamp(subDays(now, 100)), createdAt: toTimestamp(subDays(now, 170)) },
];

const getReportingPeriod = (date: Date) => {
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    const sunday = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(monday, 'yyyy/MM/dd')}-${format(sunday, 'MM/dd')}`;
}

const mockProgressLogs: ProgressLog[] = [
  // Logs for sub-1-1 (Up to date)
  { id: 'log-1-1-1', reportingPeriod: getReportingPeriod(subDays(now, 14)), executionSummary: '上週的計畫', nextWeekPlan: '完成硬體規格選定與採購。', roadblocks: '無', completionPercentage: 20, updatedAt: toTimestamp(subDays(now, 8)), createdBy: 'user-1' },
  { id: 'log-1-1-2', reportingPeriod: getReportingPeriod(subDays(now, 7)), executionSummary: '完成硬體規格選定與採購。', nextWeekPlan: '開始安裝第一批感測器。', roadblocks: '部分感測器型號交期可能延遲。', completionPercentage: 35, updatedAt: toTimestamp(subDays(now, 3)), createdBy: 'user-1' },

  // Logs for sub-1-2 (Overdue report)
  { id: 'log-1-2-1', reportingPeriod: getReportingPeriod(subDays(now, 21)), executionSummary: '完成初步需求訪談。', nextWeekPlan: '設計儀表板 UI Mockup。', roadblocks: '無', completionPercentage: 10, updatedAt: toTimestamp(subDays(now, 15)), createdBy: 'user-2' },

  // Logs for sub-1-3 (Finished, but project is overdue)
  { id: 'log-1-3-1', reportingPeriod: getReportingPeriod(subDays(now, 7)), executionSummary: '系統整合測試', nextWeekPlan: '正式上線', roadblocks: '', completionPercentage: 100, updatedAt: toTimestamp(subDays(now, 4)), createdBy: 'user-1' },

  // Logs for sub-2-1 (No logs yet)
  
  // Logs for sub-3-1 (Completed project)
  { id: 'log-3-1-1', reportingPeriod: getReportingPeriod(subDays(now, 110)), executionSummary: '完成所有功能開發與測試', nextWeekPlan: '用戶培訓與上線', roadblocks: '', completionPercentage: 100, updatedAt: toTimestamp(subDays(now, 105)), createdBy: 'user-1' },
];

// Simulate Firestore fetches
export const getProjects = async (): Promise<Project[]> => {
  return new Promise(resolve => setTimeout(() => resolve(mockProjects), 500));
};

export const getSubProjectsWithLatestLogs = async (): Promise<SubProjectWithLatestLog[]> => {
    return new Promise(resolve => setTimeout(() => {
        const result = mockSubProjects.map(sp => {
            const project = mockProjects.find(p => p.id === sp.projectId);
            const owner = mockUsers.find(u => u.id === sp.owner);

            const logs = mockProgressLogs
                .filter(log => log.id.startsWith(`log-${sp.id.split('-')[1]}-${sp.id.split('-')[2]}`))
                .sort((a, b) => b.updatedAt.seconds - a.updatedAt.seconds);
            
            const latestLog = logs[0] || null;

            const sevenDaysAgo = subDays(new Date(), 7);
            const isOverdue = latestLog?.updatedAt?.toDate()
                ? latestLog.updatedAt.toDate() < sevenDaysAgo
                : true;

            return {
                ...sp,
                expectedCompletionDate: sp.expectedCompletionDate.toDate(),
                createdAt: sp.createdAt.toDate(),
                projectName: project?.name,
                projectCaseNumber: project?.caseNumber,
                ownerName: owner?.displayName,
                latestLog: latestLog ? {
                    ...latestLog,
                    updatedAt: latestLog.updatedAt.toDate(),
                    createdByName: mockUsers.find(u => u.uid === latestLog.createdBy)?.displayName,
                } : null,
                isOverdue
            };
        });
        resolve(result);
    }, 1000));
};


export const getProgressLogsForSubProject = async (subProjectId: string): Promise<ProgressLog[]> => {
    return new Promise(resolve => setTimeout(() => {
        const logs = mockProgressLogs
            .filter(log => log.id.startsWith(`log-${subProjectId.split('-')[1]}-${subProjectId.split('-')[2]}`))
            .map(log => ({
                ...log,
                updatedAt: log.updatedAt.toDate(),
                createdByName: mockUsers.find(u => u.uid === log.createdBy)?.displayName
            }))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        resolve(logs);
    }, 700));
};

export const addProgressLog = async (subProjectId: string, logData: Omit<ProgressLog, 'id' | 'updatedAt' | 'createdBy'>): Promise<ProgressLog> => {
    return new Promise(resolve => setTimeout(() => {
        const newLog: ProgressLog = {
            id: `log-${subProjectId.split('-')[1]}-${subProjectId.split('-')[2]}-${Date.now()}`,
            ...logData,
            updatedAt: toTimestamp(new Date()),
            createdBy: 'user-1', // Assuming current user is user-1
        };
        mockProgressLogs.push(newLog);
        console.log("Added new log:", newLog);
        const resolvedLog = {
            ...newLog,
            updatedAt: newLog.updatedAt.toDate()
        }
        resolve(resolvedLog);
    }, 500));
}
