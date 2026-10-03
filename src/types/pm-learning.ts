export type PMLearningContentType = 'course' | 'article' | 'video' | 'book';
export type PMLearningTimelinessType = 'time_sensitive' | 'evergreen';

export interface PMLearningAIAnalysis {
  summary?: string;
  keyTakeaways?: string[];
  actionableInsights?: string[];
  analyzedAt?: string;
  modelName?: string;
}

export interface PMLearningChapterUnit {
  id?: string;
  title: string; // 大單元標題，例如 "單元 1" 或 "第一單元：核心概念"
  subUnits: string[]; // 子單元名稱清單，例如 ["1.1 需求訪談", "1.2 範疇設定"]
}

export interface PMLearningChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  chapterTitle?: string; // 所屬第一階「大單元 / 章節」名稱，如「單元 1」
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
  checklist: PMLearningChecklistItem[]; // 課程章節單元檢核清單
  attachments: PMLearningAttachment[];
  hoursSpent?: number; // 個人修習投入時數 (小時)
  sortOrder?: number; // 個人自訂呈現排序權重
  updatedAt?: string;
}

export interface PMLearningCourse {
  id: string;
  type?: PMLearningContentType; // 載體型態：'course' (線上課程) | 'article' (知識文章) | 'video' (影音資源) | 'book' (個人閱讀)，預設 'course'
  title: string; // 標題 (課程名稱 / 文章標題 / 影音名稱 / 書名)
  instructorOrPlatform: string; // 講師 / 平台 / 專欄來源 / 作者 (如：工研院, 數位時代, YouTube, 天下)
  category: string; // 領域分類標籤 (例如：AI應用與工具、專案管理與治理、智慧製造與技術)
  description?: string; // 簡介說明或核心導讀摘要
  externalUrl?: string; // 外部傳送門連結 (線上影片、文章原文網頁、共用資料夾)
  hours?: number; // 預計研習時數或閱讀時間 (小時)
  startDate?: string; // 預計起日 (YYYY-MM-DD)
  endDate?: string; // 預計訖日 (YYYY-MM-DD)
  assignedUserIds: string[]; // 指派研讀成員 User IDs
  assignedUserNames: string[]; // 指派研讀成員姓名清單
  defaultChecklist?: (string | PMLearningChapterUnit)[]; // 預設章節檢核清單 (支援單元字串或兩階大單元/子單元架構)
  memberProgress: Record<string, PMLearningMemberProgress>; // 每位指派成員的個人研習進度

  // === 知識文章 (Article) 與全文儲存專屬欄位 ===
  content?: string; // 文章完整內容 (支援 Markdown，含表格、引言與圖片語法)
  source?: string; // 專欄或發行來源 (如：曼報Pro、科技島專欄、數位時代、天下雜誌付費專欄)
  subSource?: string; // 專欄子分類 / 專屬單元 (如：科技曼讀、巨人之聲、商業解碼)
  issueDate?: string; // 出刊月份或期別 (如：2026-10、2026-09，便於時效與月份控管)
  timelinessType?: PMLearningTimelinessType; // 時效性：'time_sensitive' (時效趨勢) | 'evergreen' (常青知識)
  aiAnalysis?: PMLearningAIAnalysis; // AI 重點導讀與摘要成果

  // === 影音資源與個人閱讀專屬欄位 ===
  videoTimestampNotes?: string; // 影音重點時戳與筆記
  bookQuotesAndReflections?: string; // 個人閱讀反思、金句與工作落地行動清單 (Action Items)

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// 別名相容
export type PMLearningItem = PMLearningCourse;

export type PMLearningViewMode = 'team' | 'personal' | 'weekly';
export type PMTeamDisplayMode = 'list' | 'kanban';

export const DEFAULT_PM_CATEGORIES: string[] = [
  'AI應用與工具',
  '專案管理與治理',
  '智慧製造與技術',
  '敏捷方法與協同',
  '跨部門溝通與談判',
  '合約架構與成本管控',
  '品質工程與驗收規範',
];

export const CONTENT_TYPE_CONFIG: Record<
  PMLearningContentType,
  { label: string; icon: string; badgeClass: string; desc: string }
> = {
  course: {
    label: '線上課程',
    icon: '🎓',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    desc: '外部平台課程、章節檢核清單與時數管制',
  },
  article: {
    label: '知識文章',
    icon: '📄',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: '系統直接儲存完整文章內文、月份期別管理與 AI 摘要導讀',
  },
  video: {
    label: '影音資源',
    icon: '🎥',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    desc: '外部影音/Podcast 連結、重點時戳與精華筆記',
  },
  book: {
    label: '個人閱讀',
    icon: '📖',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    desc: '書籍重點反思、核心金句與落地行動清單',
  },
};
