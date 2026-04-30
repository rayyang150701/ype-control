export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'pending';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface ProgressLog {
  id: string;
  subProjectId: string;
  executionSummary: string;
  nextWeekPlan: string;
  roadblocks: string;
  completionPercentage: number;
  createdBy: string;
  createdByName?: string;
  updatedAt: string;
  reportingPeriod?: string;
}

export interface SubProject {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  isOnHold?: boolean;
  onHoldStartDate?: string;
  onHoldEndDate?: string;
  onHoldReason?: string;
  onHoldNotes?: string;
  createdAt: string;
}

export interface SubProjectWithLatestLog extends SubProject {
  projectName: string;
  projectCaseNumber: string;
  projectPurpose?: string;
  currentStatusAndIssues?: string;
  yiehPhuiProjectManager?: string;
  tpmOfficeContact?: string;
  egigaContact?: string;
  ownerName?: string;
  latestLog: ProgressLog | null;
  isOverdue: boolean;
  isParentOnHold: boolean;
}

export interface Project {
  id: string;
  caseNumber: string;
  name: string;
  projectPurpose: string;
  currentStatusAndIssues: string;
  yiehPhuiProjectManager: string;
  tpmOfficeContact: string;
  egigaContact: string;
  status: 'active' | 'on-hold' | 'completed';
  createdBy: string;
  createdAt: string;
  isOnHold?: boolean;
  onHoldStartDate?: string;
  onHoldEndDate?: string;
  onHoldReason?: string;
  onHoldNotes?: string;
}

export interface FullProject extends Project {
  subProjects: SubProjectWithLatestLog[];
}
