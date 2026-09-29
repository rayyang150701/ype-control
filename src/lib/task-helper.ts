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
 * 智慧綜合比對：
 * 1. 系統實質存檔更新日期 (updatedAt / createdAt)
 * 2. 備忘日誌各行記錄的最新進度日期 (如 2026/9/29, 9/29 等)
 * 取兩者之中最新 (Math.max) 且不超過當天未來之日期。
 * 無論使用者是「直接存檔」或是「在進度日誌中記錄日期」，都能即時準確呈現當下最新存檔與更新日期！
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
  const todayTs = today.getTime();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayDateStr = `${y}-${m}-${d}`;

  let latestDateStr = '';
  let latestTs = 0;

  // 1. 檢查系統存檔更新日期 (updatedAt / createdAt)
  const systemDateStr = item.updatedAt
    ? item.updatedAt.slice(0, 10)
    : item.createdAt
    ? item.createdAt.slice(0, 10)
    : '';

  if (systemDateStr) {
    const sysDate = new Date(`${systemDateStr}T00:00:00`);
    const sysTs = sysDate.getTime();
    if (!isNaN(sysTs)) {
      latestTs = sysTs;
      latestDateStr = systemDateStr;
    }
  }

  // 2. 檢查備忘日誌中的最新進度日期 (如 2026/9/29, 9/29)
  const noteDate = parseLatestDateFromNotes(item.notes, today.getFullYear());
  if (noteDate && noteDate.dateStr) {
    const nDate = new Date(`${noteDate.dateStr}T00:00:00`);
    const nTs = nDate.getTime();
    // 只要備忘錄中的進度日期更新（且不大於未來合理範圍），就取最新者
    if (!isNaN(nTs) && nTs > latestTs && nTs <= todayTs + 86400000) {
      latestTs = nTs;
      latestDateStr = noteDate.dateStr;
    }
  }

  // 3. 若皆無，預設為今日
  if (!latestDateStr) {
    latestDateStr = todayDateStr;
    latestTs = todayTs;
  }

  const targetDate = new Date(`${latestDateStr}T00:00:00`);
  const daysAgo = Math.max(0, differenceInCalendarDays(today, targetDate));

  return {
    dateStr: latestDateStr,
    timestamp: latestTs,
    daysAgo,
  };
}
