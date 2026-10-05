-- ============================================================
-- 專案待辦事項新增置頂標記欄位 (Action Item is_pinned Migration)
-- 執行位置：Supabase Dashboard → SQL Editor (選用，系統亦支援透明備援儲存)
-- 說明：為 project_action_items 新增 is_pinned 欄位以支援待辦重點加強追蹤置頂
-- ============================================================

ALTER TABLE public.project_action_items 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 建立索引加速置頂待辦事項查詢與排序
CREATE INDEX IF NOT EXISTS idx_action_items_is_pinned ON public.project_action_items(is_pinned);
