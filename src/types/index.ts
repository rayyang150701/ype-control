export type Timestamp = any;

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'viewer';
export type UserStatus = 'pending' | 'active';

export interface CurrentUser {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  department?: string;
  company?: string;
}

export interface User {
  uid: string;
  username?: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  clientName?: string;
  createdAt: Timestamp | Date | string;
}

export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'cancelled' | 'poc';

export type ProjectSourceType = '燁輝列管專案' | '億威內部自建專案' | '其他專案' | '其他智慧製造專案';

export interface Client {
  id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface Project {
  id: string;
  caseNumber: string;
  name: string;
  status: ProjectStatus;
  isInternal?: boolean;
  projectCategory?: '評估案' | '已開案';
  internalStatus?: 'in_progress' | 'completed' | 'terminated';
  sourceType?: ProjectSourceType;
  clientName?: string;
  responsiblePm?: string;
  clientContact?: string;
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
  sourceType?: ProjectSourceType;
  clientName?: string;
  responsiblePm?: string;
  clientContact?: string;
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

export interface DueDateChange {
  from: string | null;
  to: string | null;
  changedAt: string;
  delayDays: number;
}

export interface StatusChange {
  from: string;
  to: string;
  at: string;
}

export interface ActionItemAttachment {
  id: string;              // Google Drive File ID
  fileId?: string;         // Google Drive File ID (alias)
  name: string;            // 檔案名稱
  size: number;            // 檔案大小 (bytes)
  mimeType: string;        // MIME 類型
  webViewLink: string;     // Google Drive 雲端預覽/檢視連結
  webContentLink?: string; // 直接下載連結
  thumbnailLink?: string;  // 縮圖連結 (若有)
  uploadedAt: string;      // 上傳時間 (ISO)
}

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
  originalDueDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  dueDateHistory?: DueDateChange[];
  statusHistory?: StatusChange[];
  notes?: string;
  lessonLearnt?: string;
  attachments?: ActionItemAttachment[];
  createdAt: string;
  updatedAt: string;
  projectName?: string;
  projectCaseNumber?: string;
  projectCategory?: '評估案' | '已開案';
}

export interface WeeklySnapshotItem {
  key: string;          // e.g. "2026-09-14_2026-09-20"
  label: string;        // e.g. "2026/09/14 - 09/20"
  hasSnapshot: boolean; // 是否已轉存快照至 Storage
  savedAt?: string;     // 快照最後轉存時間 (ISO 字串)
  savedBy?: string;     // 轉存操作人
}

export interface WeeklySnapshotData {
  periodKey: string;
  periodLabel: string;
  savedAt: string;
  savedBy?: string;
  projectsCount: number;
  projects: FullProject[];
  users: User[];
}

