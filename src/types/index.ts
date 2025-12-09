import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'pending' | 'active';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp | Date | string;
}

export type ProjectStatus = 'active' | 'completed' | 'on-hold';

export interface Project {
  id: string;
  caseNumber: string;
  name: string;
  status: ProjectStatus;
  createdAt: Timestamp | Date | string;
  createdBy: string;
  projectPurpose?: string;
  currentStatusAndIssues?: string;
  yiehPhuiProjectManager?: string;
  tpmOfficeContact?: string;
  egigaContact?: string;
  subProjects?: SubProject[];
}

export interface SubProject {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  ownerName?: string;
  expectedCompletionDate: Timestamp | Date | string;
  actualCompletionDate?: Timestamp | Date | string;
  createdAt: Timestamp | Date | string;
  latestLog?: ProgressLog | null;
  projectName?: string;
  projectCaseNumber?: string;
}

export interface ProgressLog {
  id: string;
  subProjectId: string;
  reportingPeriod: string; // "2025/12/08-12/14"
  executionSummary: string;
  nextWeekPlan: string;
  roadblocks: string;
  completionPercentage: number;
  updatedAt: Timestamp | Date | string;
  createdBy: string;
  createdByName?: string;
}

export interface SubProjectWithLatestLog extends SubProject {
  isOverdue: boolean;
}

export interface FullProject extends Project {
    subProjects: SubProjectWithLatestLog[];
}

    