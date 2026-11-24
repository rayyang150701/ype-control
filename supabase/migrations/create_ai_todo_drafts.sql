-- AI 快速輸入草稿（手機口述 → 電腦確認）
-- 執行位置：Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS public.ai_todo_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  message_date DATE NOT NULL,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_todo_drafts_created_at ON public.ai_todo_drafts(created_at DESC);
-- 內容可能含對話原文：只允許伺服器端 service role 存取，不開放公開讀取
ALTER TABLE public.ai_todo_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only ai_todo_drafts" ON public.ai_todo_drafts FOR ALL USING (auth.role() = 'service_role');
