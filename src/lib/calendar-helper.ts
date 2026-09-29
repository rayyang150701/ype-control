// src/lib/calendar-helper.ts
// 行事曆與週別計算輔助函式 (移植並增強自 Emmt Nexus)

import type { WeekInfo, Holiday } from '@/types/businessTrip';

/**
 * 取得指定月份的所有日曆天數 (包含上個月底填補至週一、下個月初填補至週日，共 35 或 42 格)
 */
export const getMonthDays = (year: number, month: number): Date[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Date[] = [];

  // 填補上個月的天數（以週一為起始）
  const firstDayOfWeek = firstDay.getDay();
  const daysToAdd = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  for (let i = daysToAdd; i > 0; i--) {
    const date = new Date(year, month, 1 - i);
    days.push(date);
  }

  // 當前月份的所有天數
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  // 填補下個月的天數（補滿到週日）
  const lastDayOfWeek = lastDay.getDay();
  const daysAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

  for (let i = 1; i <= daysAfter; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
};

/**
 * 取得指定年份與週數的該週起始日期（週一，遵循標準 ISO 8601）
 */
export const getStartOfWeek = (year: number, weekNumber: number): Date => {
  // 1月4日必定屬於該年度的第 1 週 (ISO 8601 定義)
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  const diffJan4ToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const week1Monday = new Date(year, 0, 4 + diffJan4ToMonday);
  week1Monday.setHours(0, 0, 0, 0);

  const monday = new Date(
    week1Monday.getFullYear(),
    week1Monday.getMonth(),
    week1Monday.getDate() + (weekNumber - 1) * 7
  );
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * 取得指定週的所有 7 天 (週一至週日)
 */
export const getWeekDays = (year: number, weekNumber: number): Date[] => {
  const startDate = getStartOfWeek(year, weekNumber);
  const days: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    days.push(date);
  }

  return days;
};

/**
 * 計算指定日期所在的週數 (1 ~ 53，遵循標準 ISO 8601)
 */
export const getWeekNumber = (date: Date): number => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // 以該週週四所屬年份作為 ISO 年份
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const isoYear = thursday.getFullYear();

  const jan4 = new Date(isoYear, 0, 4);
  const jan4Day = jan4.getDay();
  const diffJan4ToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const week1Monday = new Date(isoYear, 0, 4 + diffJan4ToMonday);
  week1Monday.setHours(0, 0, 0, 0);

  const diffMs = monday.getTime() - week1Monday.getTime();
  const weekNumber = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.min(53, Math.max(1, weekNumber));
};

/**
 * 取得指定年份的所有週資訊 (WK01 ~ WK52/53)
 */
export const getYearWeeks = (year: number): WeekInfo[] => {
  const weeks: WeekInfo[] = [];
  // 12月28日必定屬於該年度最後一週 (ISO 8601 定義)
  const dec28 = new Date(year, 11, 28);
  const totalWeeks = getWeekNumber(dec28);

  for (let week = 1; week <= totalWeeks; week++) {
    const startDate = getStartOfWeek(year, week);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    weeks.push({
      weekNumber: week,
      year,
      startDate,
      endDate,
      label: `WK${week.toString().padStart(2, '0')}`,
    });
  }

  return weeks;
};

/**
 * 取得當前週資訊 (正確抓取今日所在的週別與起訖日)
 */
export const getCurrentWeek = (): WeekInfo => {
  const today = new Date();
  const weekNumber = getWeekNumber(today);

  // 取得 ISO 年份 (以當週週四所屬年份為準)
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const isoYear = thursday.getFullYear();

  const startDate = getStartOfWeek(isoYear, weekNumber);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return {
    weekNumber,
    year: isoYear,
    startDate,
    endDate,
    label: `WK${weekNumber.toString().padStart(2, '0')}`,
  };
};

/**
 * 檢查兩日期是否為同一天 (忽略時間)
 */
export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1.replace(/-/g, '/')) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2.replace(/-/g, '/')) : date2;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * 格式化日期為 YYYY-MM-DD
 */
export const formatDate = (date: Date | string): string => {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 格式化日期為中文 (如: 2026年9月24日)
 */
export const formatDateChinese = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date.replace(/-/g, '/')) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}年${month}月${day}日`;
};

/**
 * 格式化週資訊為中文 (如: 9月21日-9月27日)
 */
export const formatWeekChinese = (weekInfo: WeekInfo): string => {
  const startMonth = weekInfo.startDate.getMonth() + 1;
  const startDay = weekInfo.startDate.getDate();
  const endMonth = weekInfo.endDate.getMonth() + 1;
  const endDay = weekInfo.endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth}月${startDay}日 - ${endDay}日`;
  } else {
    return `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;
  }
};

/**
 * 取得星期中文名稱 (週一 ~ 週日)
 */
export const getDayName = (dayOfWeek: number): string => {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[dayOfWeek];
};

/**
 * 🔔 判斷行程是否逾期未填寫出差重點（3-Day Rule）
 * 條件：現在時間 > (出差結束時間 + 3天) 且「出差重點報告/備註 (notes)」欄位為空
 */
export const isTripReportOverdue = (
  endDate: Date | string,
  endTime: string = '17:00',
  notes?: string
): boolean => {
  if (notes && notes.trim().length > 0) {
    return false;
  }

  const d = typeof endDate === 'string' ? new Date(endDate.replace(/-/g, '/')) : new Date(endDate);
  const [hours, minutes] = (endTime || '17:00').split(':').map(Number);
  d.setHours(hours || 17, minutes || 0, 0, 0);

  // 加上 3 天緩衝時間
  const threeDaysLater = new Date(d);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const now = new Date();
  return now > threeDaysLater;
};

/**
 * 🗓️ 自動產生 Google 行事曆 URL
 * 點擊後會在新分頁開啟 Google Calendar 並自動帶入標題、時段、地點與說明
 */
export const generateGoogleCalendarUrl = (
  title: string,
  startDate: Date | string,
  startTime: string = '09:00',
  endDate: Date | string,
  endTime: string = '17:00',
  location?: string,
  details?: string
): string => {
  const formatDateTimeForGoogle = (date: Date | string, time: string): string => {
    const d = typeof date === 'string' ? new Date(date.replace(/-/g, '/')) : new Date(date);
    const [hours, minutes] = (time || '09:00').split(':').map(Number);
    d.setHours(hours || 9, minutes || 0, 0, 0);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const startStr = formatDateTimeForGoogle(startDate, startTime);
  const endStr = formatDateTimeForGoogle(endDate, endTime);

  const params = new URLSearchParams();
  params.append('action', 'TEMPLATE');
  params.append('text', title);
  params.append('dates', `${startStr}/${endStr}`);

  if (details) {
    params.append('details', details);
  }
  if (location) {
    params.append('location', location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * 查詢指定日期是否為國定假日或自訂假日
 */
export const findHoliday = (date: Date | string, holidays: Holiday[] = []): Holiday | undefined => {
  return holidays.find((h) => isSameDay(date, h.date));
};

/**
 * 內建 2025 ~ 2027 台灣主要國定假日與連假清單 (開箱即用免手動輸入)
 */
export const DEFAULT_TAIWAN_HOLIDAYS: Holiday[] = [
  // 2025
  { id: 'h-2025-01-01', name: '元旦', date: '2025-01-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-01-27', name: '除夕連假', date: '2025-01-27', isStatutory: true, category: '彈性放假' },
  { id: 'h-2025-01-28', name: '除夕', date: '2025-01-28', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-01-29', name: '春節初一', date: '2025-01-29', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-01-30', name: '春節初二', date: '2025-01-30', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-01-31', name: '春節初三', date: '2025-01-31', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-02-28', name: '和平紀念日', date: '2025-02-28', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-04-03', name: '兒童節連假', date: '2025-04-03', isStatutory: true, category: '彈性放假' },
  { id: 'h-2025-04-04', name: '清明節', date: '2025-04-04', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-05-01', name: '勞動節', date: '2025-05-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-05-31', name: '端午節', date: '2025-05-31', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-10-06', name: '中秋節', date: '2025-10-06', isStatutory: true, category: '國定假日' },
  { id: 'h-2025-10-10', name: '國慶日', date: '2025-10-10', isStatutory: true, category: '國定假日' },

  // 2026
  { id: 'h-2026-01-01', name: '元旦', date: '2026-01-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-02-15', name: '除夕前連假', date: '2026-02-15', isStatutory: true, category: '彈性放假' },
  { id: 'h-2026-02-16', name: '除夕', date: '2026-02-16', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-02-17', name: '春節初一', date: '2026-02-17', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-02-18', name: '春節初二', date: '2026-02-18', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-02-19', name: '春節初三', date: '2026-02-19', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-02-28', name: '和平紀念日', date: '2026-02-28', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-04-03', name: '兒童節連假', date: '2026-04-03', isStatutory: true, category: '彈性放假' },
  { id: 'h-2026-04-05', name: '清明節', date: '2026-04-05', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-05-01', name: '勞動節', date: '2026-05-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-06-19', name: '端午節', date: '2026-06-19', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-09-25', name: '中秋節', date: '2026-09-25', isStatutory: true, category: '國定假日' },
  { id: 'h-2026-09-26', name: '中秋連假', date: '2026-09-26', isStatutory: true, category: '彈性放假' },
  { id: 'h-2026-09-27', name: '中秋連假', date: '2026-09-27', isStatutory: true, category: '彈性放假' },
  { id: 'h-2026-09-28', name: '中秋連假', date: '2026-09-28', isStatutory: true, category: '彈性放假' },
  { id: 'h-2026-10-10', name: '國慶日', date: '2026-10-10', isStatutory: true, category: '國定假日' },

  // 2027
  { id: 'h-2027-01-01', name: '元旦', date: '2027-01-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-02-05', name: '除夕', date: '2027-02-05', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-02-06', name: '春節初一', date: '2027-02-06', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-02-28', name: '和平紀念日', date: '2027-02-28', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-04-04', name: '兒童節', date: '2027-04-04', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-04-05', name: '清明節', date: '2027-04-05', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-05-01', name: '勞動節', date: '2027-05-01', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-06-09', name: '端午節', date: '2027-06-09', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-09-15', name: '中秋節', date: '2027-09-15', isStatutory: true, category: '國定假日' },
  { id: 'h-2027-10-10', name: '國慶日', date: '2027-10-10', isStatutory: true, category: '國定假日' },
];
