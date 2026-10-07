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

/**
 * 解析待辦事項當前「待處理/等候對象」所屬之公司與部門
 * 依據順序：
 * 1. 待辦等候對象 (waitingOn) 比對系統使用者 (users: displayName, username, email)
 * 2. 關鍵字比對已知單位 (億威、燁輝、燕巢、宇陽、荃達)
 * 3. 比對客戶資料庫 (clients)
 * 4. 若等候對象未填或無法識別，以責任歸屬 (owner) 進行識別
 */
export function getItemPendingCompanyAndDepartment(
  item: { waitingOn?: string | null; owner?: string | null },
  users: Array<{ displayName?: string | null; username?: string | null; email?: string | null; clientName?: string | null; department?: string | null }> = [],
  clients: Array<{ name: string }> = []
): { company: string; department: string } {
  const waitingOn = (item.waitingOn || '').trim();
  const owner = (item.owner || '').trim();
  const target = waitingOn || owner || '';

  if (!target) {
    return { company: '未指定', department: '未指定' };
  }

  // 1. 直接比對 users 成員清單
  const matchedUser = users.find((u) => {
    const dn = (u.displayName || '').trim();
    const un = (u.username || '').trim();
    const em = (u.email || '').trim().toLowerCase();
    const t = target.toLowerCase();
    return (
      (dn && dn.toLowerCase() === t) ||
      (un && un.toLowerCase() === t) ||
      (em && em === t) ||
      (dn && target.includes(dn))
    );
  });

  if (matchedUser) {
    return {
      company: matchedUser.clientName?.trim() || '未指定',
      department: matchedUser.department?.trim() || '未指定',
    };
  }

  // 2. 關鍵字比對已知單位
  if (target.includes('億威')) return { company: '億威電子', department: '億威各部門' };
  if (target.includes('燕巢')) return { company: '燁輝燕巢', department: '燁輝設計課' };
  if (target.includes('燁輝')) return { company: '燁輝', department: 'TPM' };
  if (target.includes('宇陽')) return { company: '宇陽傳動', department: '技術部' };
  if (target.includes('荃達')) return { company: '荃達', department: '技術' };

  // 3. 比對 clients 維護清單
  const matchedClient = clients.find((c) => {
    const cn = (c.name || '').trim();
    return cn && (cn === target || target.includes(cn) || cn.includes(target));
  });
  if (matchedClient) {
    return { company: matchedClient.name, department: '未指定' };
  }

  // 4. 若有指定 owner 且 owner 與 waitingOn 不同，以 owner 再度嘗試識別
  if (waitingOn && owner && owner !== waitingOn) {
    const ownerUser = users.find((u) => {
      const dn = (u.displayName || '').trim();
      return dn && dn === owner;
    });
    if (ownerUser) {
      return {
        company: ownerUser.clientName?.trim() || '未指定',
        department: ownerUser.department?.trim() || '未指定',
      };
    }
    if (owner.includes('億威')) return { company: '億威電子', department: '億威各部門' };
    if (owner.includes('燕巢')) return { company: '燁輝燕巢', department: '燁輝設計課' };
    if (owner.includes('燁輝')) return { company: '燁輝', department: 'TPM' };
    if (owner.includes('宇陽')) return { company: '宇陽傳動', department: '技術部' };
    if (owner.includes('荃達')) return { company: '荃達', department: '技術' };
    return { company: owner, department: '未指定' };
  }

  return { company: '未指定', department: '未指定' };
}

