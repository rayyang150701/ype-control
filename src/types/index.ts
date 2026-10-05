export type Timestamp = any;

export type UserRole =
  | 'admin'        // 管理者 (Admin)
  | 'management'   // 億威 PM (Management)
  | 'execution'    // 億威各部門 (Execution)
  | 'monitor'      // 燁輝/其他 (Monitor)
  | 'guest'        // 訪客 (Guest)
  | 'super_admin'  // 相容舊資料 (視同 admin)
  | 'editor'       // 相容舊資料
  | 'viewer';      // 相容舊資料
export type UserStatus = 'pending' | 'active';

export interface CurrentUser {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  department?: string;
  company?: string;
  clientName?: string;
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

export type ProjectSourceType = '燁輝列管專案' | '燁輝請購案' | '億威內部自建專案' | '其他專案' | '其他智慧製造專案';

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
  internalStatus?: 'in_progress' | 'completed' | 'terminated' | 'on_hold';
  sourceType?: ProjectSourceType;
  clientName?: string;
  responsiblePm?: string;
  clientContact?: string;
  expectedCompletionDate?: string | null;
  evaluationDate?: string | null;
  kickoffDate?: string | null;
  vendorOrSupplier?: string;
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
  phaseSchedules?: ProjectPhaseSchedules;
}

export interface PhaseSchedule {
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectPhaseSchedules {
  design?: PhaseSchedule;       // 1.1 設計階段
  construction?: PhaseSchedule; // 1.2 施工階段
  verification?: PhaseSchedule; // 1.3 驗證階段
  acceptance?: PhaseSchedule;   // 1.4 驗收階段
}

export interface InternalProjectOption {
  id: string;
  caseNumber: string;
  name: string;
  category: '評估案' | '已開案';
  internalStatus: 'in_progress' | 'completed' | 'terminated' | 'on_hold';
  sourceType?: ProjectSourceType;
  clientName?: string;
  responsiblePm?: string;
  clientContact?: string;
  expectedCompletionDate?: string | null;
  evaluationDate?: string | null;
  kickoffDate?: string | null;
  vendorOrSupplier?: string;
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
  | '1.1 設計階段'
  | '1.1.1 評估'
  | '1.1.2 報價'
  | '1.1.3 簽呈'
  | '1.2 施工階段'
  | '1.3 驗證階段'
  | '1.4 驗收階段'
  | '1.4.1 教育訓練'
  | '1.4.2 驗收結案'
  // 舊制向下相容
  | '評估階段' 
  | '報價/設計' 
  | '簽呈核決' 
  | '開發/施工' 
  | '驗證測試' 
  | '驗收結案'
  | string;

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
  isPinned?: boolean;
  meetingUrl?: string;
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

export * from './businessTrip';

// ==========================================
// 修改履歷與稽核紀錄 (Audit Log / Change Log)
// ==========================================

export interface AuditOperator {
  uid?: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
}

export interface AuditDiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export type AuditActionType =
  | 'PROGRESS_LOG_CREATE'   // 新增週報
  | 'PROGRESS_LOG_UPDATE'   // 更新週報
  | 'PROGRESS_LOG_DELETE'   // 刪除週報
  | 'PROJECT_CREATE'        // 新增專案
  | 'PROJECT_UPDATE'        // 編輯專案
  | 'PROJECT_DELETE'        // 刪除專案
  | 'PROJECT_ON_HOLD'       // 設定暫緩
  | 'PROJECT_RESUME'        // 恢復專案
  | 'PHASE_SCHEDULE_UPDATE' // 更新階段時程
  | 'ACTION_ITEM_CREATE'    // 新增待辦
  | 'ACTION_ITEM_UPDATE'    // 更新待辦
  | 'ACTION_ITEM_DELETE'    // 刪除待辦
  | 'TRIP_CREATE'           // 新增行程
  | 'TRIP_UPDATE'           // 更新行程
  | 'TRIP_DELETE'           // 刪除行程
  | 'OTHER';

export interface AuditLog {
  id: string;
  createdAt: string;
  operatorId?: string;
  operatorName: string;
  operatorEmail?: string;
  operatorRole?: string;
  operatorDepartment?: string;
  actionType: AuditActionType;
  actionLabel: string;
  projectId?: string;
  projectName?: string;
  targetId?: string;
  targetName?: string;
  summary: string;
  diffs?: AuditDiffItem[];
  metadata?: Record<string, any>;
}



