import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'pending' | 'active';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
}

export type ProjectStatus = 'active' | 'completed' | 'on-hold';

export interface Project {
  id: string;
  caseNumber: string;
  name: string;
  status: ProjectStatus;
  createdAt: Timestamp;
  createdBy: string;
  subProjects?: SubProject[];
}

export interface SubProject {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  ownerName?: string;
  expectedCompletionDate: Timestamp;
  createdAt: Timestamp;
  latestLog?: ProgressLog | null;
  projectName?: string;
  projectCaseNumber?: string;
}

export interface ProgressLog {
  id: string;
  reportingPeriod: string; // "2025/12/08-12/14"
  executionSummary: string;
  nextWeekPlan: string;
  roadblocks: string;
  completionPercentage: number;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}

export interface SubProjectWithLatestLog extends SubProject {
  isOverdue: boolean;
}
