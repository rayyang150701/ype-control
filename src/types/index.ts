export type Timestamp = any;

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

export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'cancelled' | 'poc';

export interface Project {
  id: string;
  caseNumber: string;
  name: string;
  status: ProjectStatus;
  isInternal?: boolean;
  projectCategory?: '評估案' | '已開案';
  internalStatus?: 'in_progress' | 'completed' | 'terminated';
  expectedCompletionDate?: string | null;
  autoCompletedByClient?: boolean;
  linkedInternalProjectId?: string;
  linkedInternalProjectName?: string;
  linkedCustomerProjectId?: string;
  linkedCustomerProjectName?: string;
  createdAt: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
  createdBy: string;
  projectPurpose?: string;
  currentStatusAndIssues?: string;
  yiehPhuiProjectManager?: string;
  tpmOfficeContact?: string;
  egigaContact?: string;
  subProjects?: SubProject[];
  isOnHold?: boolean;
  onHoldReason?: string;
  onHoldStartDate?: Timestamp | Date | string;
  onHoldEndDate?: Timestamp | Date | string;
  onHoldNotes?: string;
}

export interface InternalProjectOption {
  id: string;
  caseNumber: string;
  name: string;
  category: '評估案' | '已開案';
  internalStatus: 'in_progress' | 'completed' | 'terminated';
  expectedCompletionDate?: string | null;
  tpmOfficeContact?: string;
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
  projectPurpose?: string;
  currentStatusAndIssues?: string;
  yiehPhuiProjectManager?: string;
  tpmOfficeContact?: string;
  egigaContact?: string;
  isOnHold?: boolean;
  isParentOnHold?: boolean;
  onHoldReason?: string;
  onHoldStartDate?: Timestamp | Date | string;
  onHoldEndDate?: Timestamp | Date | string;
  onHoldNotes?: string;
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

export type ActionItemPhase = 
  | '評估階段' 
  | '報價/設計' 
  | '簽呈核決' 
  | '開發/施工' 
  | '驗證測試' 
  | '驗收結案';

export type ActionItemStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';

export interface ProjectActionItem {
  id: string;
  projectId: string;
  subProjectId?: string | null;
  title: string;
  phase: ActionItemPhase;
  status: ActionItemStatus;
  owner: string;
  waitingOn?: string;
  dueDate?: string | null;
  completedAt?: string | null;
  notes?: string;
  lessonLearnt?: string;
  createdAt: string;
  updatedAt: string;
  projectName?: string;
  projectCaseNumber?: string;
  projectCategory?: '評估案' | '已開案';
}
