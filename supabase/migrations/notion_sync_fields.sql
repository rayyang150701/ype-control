-- ============================================================
-- Notion 同步欄位 Migration
-- 執行位置：Supabase Dashboard → SQL Editor
-- 說明：為 business_trips 資料表加入 Notion 同步所需欄位
-- ============================================================

-- 1. 加入 notion_page_id 欄位（用於對應 Notion 頁面，避免重複新增）
ALTER TABLE business_trips
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT UNIQUE;

-- 2. 加入 notion_synced_at 欄位（記錄最後同步時間，供偵錯使用）
ALTER TABLE business_trips
  ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ;

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_business_trips_notion_page_id
  ON business_trips (notion_page_id)
  WHERE notion_page_id IS NOT NULL;

-- 確認欄位已新增
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_trips'
  AND column_name IN ('notion_page_id', 'notion_synced_at')
ORDER BY column_name;
