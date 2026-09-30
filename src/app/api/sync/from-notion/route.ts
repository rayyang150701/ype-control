// src/app/api/sync/from-notion/route.ts
// Notion → Supabase 同步 API Route
// 觸發方式：
//   1. Vercel Cron Job（每 15 分鐘自動執行）
//   2. 手動呼叫：GET /api/sync/from-notion?secret=YOUR_CRON_SECRET
//   3. 網頁「手動同步」按鈕（POST）

import { NextRequest, NextResponse } from 'next/server';
import { Client as NotionClient } from '@notionhq/client';
import { createClient } from '@/lib/supabase/server';
import { fetchAllNotionTrips, notionPageToTrip } from '@/lib/notion-sync';

// ─────────────────────────────────────────────
// 環境變數
// ─────────────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const CRON_SECRET = process.env.CRON_SECRET; // 防止未授權呼叫

// ─────────────────────────────────────────────
// GET：Vercel Cron Job 觸發（帶 secret 驗證）
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // 驗證 Cron Secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') ?? request.headers.get('authorization')?.replace('Bearer ', '');

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runSync();
}

// ─────────────────────────────────────────────
// POST：網頁手動同步按鈕
// ─────────────────────────────────────────────
export async function POST() {
  return runSync();
}

// ─────────────────────────────────────────────
// 主同步邏輯
// ─────────────────────────────────────────────
async function runSync(): Promise<NextResponse> {
  const startTime = Date.now();

  // 檢查環境變數
  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少 Notion 設定：請在環境變數中設定 NOTION_TOKEN 和 NOTION_DATABASE_ID',
      },
      { status: 500 }
    );
  }

  try {
    const notion = new NotionClient({ auth: NOTION_TOKEN });
    const supabase = await createClient();

    // 1. 從 Notion 拉取所有行程
    console.log('[Notion Sync] 開始從 Notion 拉取行程...');
    const pages = await fetchAllNotionTrips(notion, NOTION_DATABASE_ID);
    console.log(`[Notion Sync] 拉取到 ${pages.length} 筆 Notion 行程`);

    // 2. 轉換為系統格式
    const notionTrips = pages
      .map((page) => notionPageToTrip(page))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    console.log(`[Notion Sync] 成功轉換 ${notionTrips.length} 筆行程`);

    // 3. 取得 Supabase 現有的 notion_synced 行程（避免覆蓋手動新增的資料）
    const { data: existingTrips, error: fetchError } = await supabase
      .from('business_trips')
      .select('id, notion_page_id, updated_at')
      .not('notion_page_id', 'is', null);

    if (fetchError) {
      console.error('[Notion Sync] 讀取 Supabase 失敗:', fetchError);
      throw fetchError;
    }

    const existingMap = new Map(
      (existingTrips ?? []).map((t: any) => [t.notion_page_id, t])
    );

    // 4. 逐筆 upsert（新增或更新）
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const trip of notionTrips) {
      const notionPageId = trip.id!;

      // 轉換為 Supabase 欄位格式
      const record = {
        notion_page_id: notionPageId,
        subject: trip.subject,
        start_date: trip.startDate,
        start_time: trip.startTime,
        end_date: trip.endDate,
        end_time: trip.endTime,
        location: trip.location || '',
        travelers: trip.travelers ?? [],
        customer_name: trip.customerName ?? null,
        project_name: trip.projectName ?? null,
        status: trip.status ?? 'pending',
        category: trip.category ?? 'business',
        notes: trip.notes ?? null,
        pm: trip.pm ?? null,
        tpm: trip.tpm ?? null,
        lunch_boxes: trip.lunchBoxes ?? null,
        notion_synced_at: new Date().toISOString(),
      };

      const existing = existingMap.get(notionPageId);

      if (!existing) {
        // 新增
        const { error } = await supabase.from('business_trips').insert(record);
        if (error) {
          errors.push(`新增失敗 [${trip.subject}]: ${error.message}`);
        } else {
          created++;
        }
      } else {
        // 更新（僅在 Notion 有更新時才覆蓋）
        const { error } = await supabase
          .from('business_trips')
          .update(record)
          .eq('notion_page_id', notionPageId);

        if (error) {
          errors.push(`更新失敗 [${trip.subject}]: ${error.message}`);
        } else {
          updated++;
        }
      }
    }

    const elapsed = Date.now() - startTime;

    console.log(`[Notion Sync] 完成：新增 ${created}，更新 ${updated}，略過 ${skipped}，耗時 ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      stats: {
        total: notionTrips.length,
        created,
        updated,
        skipped,
        errors: errors.length,
        elapsedMs: elapsed,
      },
      errors: errors.length > 0 ? errors : undefined,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Notion Sync] 同步失敗:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? '同步時發生未知錯誤',
        syncedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
