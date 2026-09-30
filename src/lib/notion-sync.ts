// src/lib/notion-sync.ts
// Notion → Supabase 單向同步工具函式（相容 @notionhq/client v5.x）
// 讀取 Notion 行程資料庫，轉換欄位後寫入 Supabase business_trips

import { Client as NotionClient, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { BusinessTrip, TripCategory, TripStatus } from '@/types/businessTrip';

// ─────────────────────────────────────────────
// Notion 欄位名稱對應設定（可依實際 Notion DB 欄位修改）
// ─────────────────────────────────────────────
export const NOTION_FIELD_MAP = {
  subject: '名稱',            // Title（行程主題）
  startDate: '日期',          // Date（開始，含結束）
  endDate: '結束日期',        // Date（若結束日期獨立欄位時填寫，否則留空串）
  location: '地點',           // Text or Select
  travelers: '出差人員',       // Multi-select
  customerName: '客戶',       // Select or Text
  projectName: '專案',        // Select or Text
  status: '確認狀態',         // Select: 已確認 / 待確認
  category: '類別',           // Select: 出差 / 會議 / 線上會議 / 其他
  notes: '出差重點彙整',       // Rich Text
  pm: '負責PM',               // Select or Text
  tpm: 'TPM',                 // Select or Text
  lunchBoxes: '便當數',       // Number
} as const;

// ─────────────────────────────────────────────
// 狀態 / 類別對應
// ─────────────────────────────────────────────
const STATUS_MAP: Record<string, TripStatus> = {
  '已確認': 'confirmed',
  'confirmed': 'confirmed',
  '待確認': 'pending',
  'pending': 'pending',
};

const CATEGORY_MAP: Record<string, TripCategory> = {
  '出差': 'business',
  'business': 'business',
  '會議': 'meeting',
  'meeting': 'meeting',
  '線上會議': 'online_meeting',
  'online_meeting': 'online_meeting',
  '其他': 'other',
  'other': 'other',
};

// ─────────────────────────────────────────────
// Notion Property 解析工具（型別安全）
// ─────────────────────────────────────────────
function getProp(page: PageObjectResponse, key: string) {
  return page.properties[key] ?? null;
}

function getTitle(page: PageObjectResponse, key: string): string {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'title') return '';
  return (prop as any).title.map((t: any) => t.plain_text).join('').trim();
}

function getRichText(page: PageObjectResponse, key: string): string {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'rich_text') return '';
  return (prop as any).rich_text.map((t: any) => t.plain_text).join('').trim();
}

function getSelect(page: PageObjectResponse, key: string): string {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'select') return '';
  return (prop as any).select?.name ?? '';
}

function getMultiSelect(page: PageObjectResponse, key: string): string[] {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'multi_select') return [];
  return (prop as any).multi_select.map((s: any) => s.name);
}

function getNumber(page: PageObjectResponse, key: string): number | undefined {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'number') return undefined;
  return (prop as any).number ?? undefined;
}

function parseDate(raw: string | null | undefined): { date: string; time: string } | null {
  if (!raw) return null;
  if (raw.includes('T')) {
    const [datePart, timePart] = raw.split('T');
    return { date: datePart, time: timePart.slice(0, 5) };
  }
  return { date: raw, time: '' };
}

function getDateStart(page: PageObjectResponse, key: string): { date: string; time: string } | null {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'date') return null;
  return parseDate((prop as any).date?.start);
}

function getDateEnd(page: PageObjectResponse, key: string): { date: string; time: string } | null {
  const prop = getProp(page, key);
  if (!prop || prop.type !== 'date') return null;
  const dateObj = (prop as any).date;
  return parseDate(dateObj?.end ?? dateObj?.start);
}

// ─────────────────────────────────────────────
// Notion Page → BusinessTrip 轉換
// ─────────────────────────────────────────────
export function notionPageToTrip(page: PageObjectResponse): Partial<BusinessTrip> | null {
  const fm = NOTION_FIELD_MAP;

  const subject = getTitle(page, fm.subject);
  if (!subject) return null;

  const startInfo = getDateStart(page, fm.startDate);
  if (!startInfo) return null;

  // 結束日期：先找獨立欄位，沒有就用開始日期欄位的 end
  let endInfo: { date: string; time: string } | null = null;
  if (fm.endDate) endInfo = getDateStart(page, fm.endDate);
  if (!endInfo) endInfo = getDateEnd(page, fm.startDate);
  if (!endInfo) endInfo = { date: startInfo.date, time: '17:00' };

  const statusRaw = getSelect(page, fm.status);
  const status: TripStatus = STATUS_MAP[statusRaw] ?? 'pending';

  const categoryRaw = getSelect(page, fm.category);
  const category: TripCategory = CATEGORY_MAP[categoryRaw] ?? 'business';

  const travelers = getMultiSelect(page, fm.travelers);
  const notes = getRichText(page, fm.notes);
  const location = getRichText(page, fm.location) || getSelect(page, fm.location);
  const customerName = getSelect(page, fm.customerName) || getRichText(page, fm.customerName);
  const projectName = getSelect(page, fm.projectName) || getRichText(page, fm.projectName);
  const pm = getSelect(page, fm.pm) || getRichText(page, fm.pm);
  const tpm = getSelect(page, fm.tpm) || getRichText(page, fm.tpm);
  const lunchBoxes = getNumber(page, fm.lunchBoxes);

  return {
    id: page.id.replace(/-/g, ''),
    subject,
    startDate: startInfo.date,
    startTime: startInfo.time || '09:00',
    endDate: endInfo.date,
    endTime: endInfo.time || '17:00',
    location: location || '',
    travelers,
    customerName: customerName || undefined,
    projectName: projectName || undefined,
    status,
    category,
    notes: notes || undefined,
    pm: pm || undefined,
    tpm: tpm || undefined,
    lunchBoxes: lunchBoxes ?? undefined,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

// ─────────────────────────────────────────────
// 從 Notion dataSources 拉取所有行程（v5.x API）
// ─────────────────────────────────────────────
export async function fetchAllNotionTrips(
  notion: NotionClient,
  databaseId: string
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    // v5.x 使用 dataSources.query 取代舊版 databases.query
    const response: {
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    } = await (notion as any).dataSources.query({
      data_source_id: databaseId,
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
