import { differenceInCalendarDays } from 'date-fns';
import type { ProjectActionItem } from '@/types';

/**
 * 從待辦事項備忘錄 (notes) 各行行首解析最新的進度日期
 * 支援格式：
 * - "9/29, 目前預計..."
 * - "9/24, 評估專案..."
 * - "1. 9/8 燁輝現場開會..."
 * - "- 9/24 計畫書製作"
 * - "2026/09/24 說明"
 * - "2026-09-29 說明"
 */
export function parseLatestDateFromNotes(
  notes?: string | null,
  fallbackYear?: number
): { dateStr: string; timestamp: number } | null {
  if (!notes) return null;
  const currentYear = fallbackYear || new Date().getFullYear();
  // 去除 ATTACHMENTS 區塊
  const clean = notes.replace(/<!--ATTACHMENTS:[\s\S]*?-->/g, '').trim();
  const lines = clean.split('\n');

  let latestTs = 0;
  let latestDateStr = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 匹配行首日期（允許列表符號如 "1. ", "- ", "* ", "【" 等）
    const match = line.match(/^(?:(?:\d+[\.\、\)]|\-|\*|\•)\s*)?(?:【)?(\d{4})?[-/.]?(\d{1,2})[-/.](\d{1,2})/);
    if (match) {
      const y = match[1] ? parseInt(match[1], 10) : currentYear;
      const m = parseInt(match[2], 10);
      const d = parseInt(match[3], 10);

      // 驗證月日有效性
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${y}-${mm}-${dd}`;
        const ts = new Date(`${dateStr}T12:00:00`).getTime();
        if (!isNaN(ts) && ts > latestTs) {
          latestTs = ts;
          latestDateStr = dateStr;
        }
      }
    }
  }

  if (latestTs > 0 && latestDateStr) {
    return { dateStr: latestDateStr, timestamp: latestTs };
  }
  return null;
}

/**
 * 取得待辦事項的「最近更新日期」資訊
 * 根據使用者存檔時的系統更新日期 (updatedAt，若無則 createdAt) 為權威基準。
 * 當使用者存檔時即會記錄當天最新日期。
 */
export function getItemLastUpdateDate(item: {
  updatedAt?: string | null;
  createdAt?: string | null;
  notes?: string | null;
}): {
  dateStr: string;
  timestamp: number;
  daysAgo: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. 優先以系統實質存檔更新日期為準 (每次存檔即為當天最新日期)
  const systemDateStr = item.updatedAt
    ? item.updatedAt.slice(0, 10)
    : item.createdAt
    ? item.createdAt.slice(0, 10)
    : '';

  let finalDateStr = '';
  if (systemDateStr) {
    finalDateStr = systemDateStr;
  } else {
    // 2. 備援：若無系統時間戳記，嘗試解析備忘錄中記錄的日期或使用今日
    const yearHint = today.getFullYear();
    const noteDate = parseLatestDateFromNotes(item.notes, yearHint);
    if (noteDate && noteDate.dateStr) {
      finalDateStr = noteDate.dateStr;
    } else {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      finalDateStr = `${y}-${m}-${d}`;
    }
  }

  const targetDate = new Date(`${finalDateStr}T00:00:00`);
  const timestamp = !isNaN(targetDate.getTime()) ? targetDate.getTime() : today.getTime();
  const daysAgo = Math.max(0, differenceInCalendarDays(today, targetDate));

  return {
    dateStr: finalDateStr,
    timestamp,
    daysAgo,
  };
}
