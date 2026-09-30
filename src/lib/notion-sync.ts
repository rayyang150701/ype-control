// src/lib/notion-sync.ts
// Notion → Supabase 單向同步工具函式（100% 針對億威 Notion 行程資料庫結構量身調校）

import { Client as NotionClient, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { BusinessTrip, TripCategory, TripStatus } from '@/types/businessTrip';

// ─────────────────────────────────────────────
// 億威 Notion 資料庫真實欄位名稱對應
// ─────────────────────────────────────────────
export const NOTION_FIELD_MAP = {
  subject: '行程目的',      // Title
  startDate: '開始日期',    // Date
  time: '時間',            // Multi-select: 例如 ["10:30~12:00"]
  category: '行程類型',     // Select: 出差 / 會議 / 線上會議 / POC安裝後追蹤 等
  unconfirm: '行程unconfirm', // Checkbox: true (待確認) / false (已確認)
  status: '狀態',          // Status: 未開始 / 進行中 / 完成
  recordStatus: '紀錄重點', // Status: 未開始 / 進行中 / 完成
  customer: '客戶',        // Select: 燁輝、義大醫院 等
  project: '專案名稱',      // Select: 天車吊運、智慧醫療 等
  travelers: '參與對象',    // Multi-select: Eric, Mike, 其邦 等
  tpm: 'TPM',              // Multi-select: 徐智宏 等
  lunchBoxes: '便當數量',   // Number
  place: 'Place',          // Place
} as const;

// 類別對應
function mapCategory(raw: string): TripCategory {
  if (!raw) return 'business';
  if (raw.includes('會議') && raw.includes('線上')) return 'online_meeting';
  if (raw.includes('會議')) return 'meeting';
  if (raw.includes('出差')) return 'business';
  return 'other';
}

// 時間字串解析：例如 "13:00~14:00" 或 "10:30-12:00"
function parseTimeRange(timeStr?: string): { startTime: string; endTime: string } {
  if (!timeStr) return { startTime: '09:00', endTime: '17:00' };
  const parts = timeStr.split(/[~～\-－]/).map((s) => s.trim());
  const startTime = parts[0] || '09:00';
  const endTime = parts[1] || '17:00';
  return { startTime, endTime };
}

// ─────────────────────────────────────────────
// Notion Page → BusinessTrip 轉換
// ─────────────────────────────────────────────
export async function notionPageToTrip(
  notion: NotionClient,
  page: PageObjectResponse
): Promise<Partial<BusinessTrip> | null> {
  const props = page.properties as any;

  // 1. 主題 (必填)
  const subject = props['行程目的']?.title?.map((t: any) => t.plain_text).join('').trim();
  if (!subject) return null;

  // 2. 日期 (必填)
  const dateObj = props['開始日期']?.date;
  if (!dateObj?.start) return null;
  const startDate = dateObj.start.slice(0, 10);
  const endDate = dateObj.end ? dateObj.end.slice(0, 10) : startDate;

  // 3. 時間 (從「時間」多選屬性或日期取得)
  const timeNames = props['時間']?.multi_select?.map((s: any) => s.name) || [];
  const timeStr = timeNames[0] || '';
  const { startTime, endTime } = parseTimeRange(timeStr);

  // 4. 確認狀態：優先看「行程unconfirm」checkbox
  const isUnconfirmed = props['行程unconfirm']?.checkbox === true;
  const status: TripStatus = isUnconfirmed ? 'pending' : 'confirmed';

  // 5. 類別
  const categoryRaw = props['行程類型']?.select?.name || '出差';
  const category = mapCategory(categoryRaw);

  // 6. 客戶與專案
  const customerName = props['客戶']?.select?.name || undefined;
  const projectName = props['專案名稱']?.select?.name || undefined;

  // 7. 出差人員 (參與對象)
  const travelers = props['參與對象']?.multi_select?.map((s: any) => s.name) || [];

  // 8. TPM
  const tpmList = props['TPM']?.multi_select?.map((s: any) => s.name) || [];
  const tpm = tpmList.join(', ') || undefined;

  // 9. 地點：若 Place 為空，可 fallback 到客戶名稱
  const placeRaw = props['Place']?.place?.name || props['Place']?.name || '';
  const location = placeRaw || customerName || '';

  // 10. 便當數
  const lunchBoxes = props['便當數量']?.number ?? undefined;

  // 11. 出差重點 (notes)：
  // 僅當 Notion「紀錄重點」標記為 "完成" 時才拉取內文，避免觸發 Notion API 速率限制 (3 req/s)
  let notes: string | undefined = undefined;
  const recordStatus = props['紀錄重點']?.status?.name;

  if (recordStatus === '完成') {
    try {
      const blocks = await (notion.blocks.children.list as any)({
        block_id: page.id,
        page_size: 50,
      });
      const lines = (blocks.results || [])
        .map((b: any) => {
          const typeObj = b[b.type];
          return typeObj?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        })
        .filter((line: string) => line.trim().length > 0);

      notes = lines.length > 0 ? lines.join('\n') : '【Notion 標記已完成出差紀錄】';
    } catch (err) {
      notes = '【Notion 標記已完成出差紀錄】';
    }
  }

  return {
    id: page.id.replace(/-/g, ''),
    subject,
    startDate,
    startTime,
    endDate,
    endTime,
    location,
    travelers,
    customerName,
    projectName,
    status,
    category,
    notes,
    tpm,
    lunchBoxes,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

// ─────────────────────────────────────────────
// 從 Notion 拉取所有行程（自動取得 dataSourceId 並分頁）
// ─────────────────────────────────────────────
export async function fetchAllNotionTrips(
  notion: NotionClient,
  databaseId: string
): Promise<PageObjectResponse[]> {
  // 自動解析 targetDataSourceId
  let targetDataSourceId = databaseId;
  try {
    const db = await (notion.databases.retrieve as any)({ database_id: databaseId });
    if (db.data_sources?.[0]?.id) {
      targetDataSourceId = db.data_sources[0].id;
    }
  } catch (e) {
    // 若傳入的已經是 dataSourceId 則直接使用
  }

  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response: {
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    } = await (notion as any).dataSources.query({
      data_source_id: targetDataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const item of response.results ?? []) {
      if (isFullPage(item as any)) {
        pages.push(item as PageObjectResponse);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}
