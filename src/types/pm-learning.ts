export interface PMLearningChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface PMLearningAttachment {
  id: string;
  title: string;
  url: string;
  type?: 'drive' | 'link' | 'file';
  createdAt?: string;
}

export interface PMLearningMemberProgress {
  userId: string;
  userName: string;
  userEmail?: string;
  progressPercent: number; // 0 - 100
  isCompleted: boolean;
  completedAt?: string;
  notes?: string; // Markdown 或簡易富文本內容
  checklist: PMLearningChecklistItem[];
  attachments: PMLearningAttachment[];
  updatedAt?: string;
}

export interface PMLearningCourse {
  id: string;
  title: string; // 課程名稱
  instructorOrPlatform: string; // 講師 / 平台 (如：工研院, Hahow, 內部講師, Coursera, PMP)
  category: string; // 課程類別 (例如：專案管理、智慧製造、系統架構、合約與溝通、敏捷開發)
  description?: string; // 課程說明與核心目標
  externalUrl?: string; // 外部傳送門連結 (線上影片、官方課程網頁、共用資料夾)
  startDate?: string; // 預計起日 (YYYY-MM-DD)
  endDate?: string; // 預計訖日 (YYYY-MM-DD)
  assignedUserIds: string[]; // 指派受訓成員 User IDs
  assignedUserNames: string[]; // 指派受訓成員姓名清單
  defaultChecklist?: string[]; // 建立課程時設定的預設待辦檢核清單
  memberProgress: Record<string, PMLearningMemberProgress>; // 每位指派成員的個人學習進度，以 userId 為 key
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type PMLearningViewMode = 'team' | 'personal';
export type PMTeamDisplayMode = 'list' | 'kanban';
