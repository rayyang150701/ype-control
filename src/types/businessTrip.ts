// src/types/businessTrip.ts
// 出差行程管理型別定義 (移植並增強自 Emmt Nexus)

export type TripCategory = 'business' | 'meeting' | 'other';
export type TripStatus = 'confirmed' | 'pending';
export type CalendarViewType = 'month' | 'week' | 'list' | 'overdue';

export interface BusinessTrip {
  id: string;
  subject: string; // 主題 / 出差任務內容
  projectId?: string; // 關聯專案 ID (選填，從 projects 選擇)
  projectName?: string; // 專案名稱
  customerId?: string; // 關聯客戶 ID (選填，從 clients 選擇)
  customerName?: string; // 客戶名稱 (如：燁輝、正和鋼鐵、宇陽傳動等)
  travelers: string[]; // 出差參與人員名單 (如：["施雲翔", "徐智宏"])
  location: string; // 出差地點 / 廠區
  startDate: string; // 開始日期 (格式: "YYYY-MM-DD")
  endDate: string; // 結束日期 (格式: "YYYY-MM-DD")
  startTime: string; // 開始時間 (格式: "HH:mm")
  endTime: string; // 結束時間 (格式: "HH:mm")
  category: TripCategory; // 類別: 出差、會議、其他
  tpm?: string; // TPM 負責人 / 窗口
  status: TripStatus; // 確認狀態: confirmed (已確認) | pending (待確認)
  notes?: string; // 出差重點報告 / 備忘錄
  createdBy?: string; // 建立者
  createdAt?: string;
  updatedAt?: string;
}

export interface TripCategoryInfo {
  value: TripCategory;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const TRIP_CATEGORIES: TripCategoryInfo[] = [
  {
    value: 'business',
    label: '出差',
    color: '#2563eb', // blue-600
    bgColor: '#dbeafe', // blue-100
    borderColor: '#3b82f6', // blue-500
  },
  {
    value: 'meeting',
    label: '會議',
    color: '#059669', // emerald-600
    bgColor: '#d1fae5', // emerald-100
    borderColor: '#10b981', // emerald-500
  },
  {
    value: 'other',
    label: '其他',
    color: '#4b5563', // gray-600
    bgColor: '#f3f4f6', // gray-100
    borderColor: '#6b7280', // gray-500
  },
];

// 時間選項（每半小時）
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

// 篩選條件
export interface TripFilter {
  travelers?: string[]; // 出差人員
  customerId?: string; // 客戶 ID
  projectId?: string; // 專案 ID
  tpm?: string; // TPM
  week?: number; // 週別（例如：1-52）
  year?: number; // 年份
  category?: TripCategory; // 出差類別
  status?: TripStatus; // 確認狀態
  startDate?: string; // 開始日期範圍
  endDate?: string; // 結束日期範圍
  searchKeyword?: string; // 統一搜尋關鍵字（人員、主題或專案）
}

// 週資訊
export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  label: string; // 例如：WK01, WK02
}

// 假日資訊
export interface Holiday {
  id: string;
  name: string; // 假日名稱 (如: 國慶日、中秋節)
  date: string; // 日期 (YYYY-MM-DD)
  isStatutory?: boolean; // 是否為國定假日
}
