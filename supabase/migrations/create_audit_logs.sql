-- ============================================================
-- 修改履歷紀錄表 (Audit Logs / Change History) Migration
-- 執行位置：Supabase Dashboard → SQL Editor
-- 說明：記錄各部門人員、PM 與管理者對專案、週報與待辦的修改履歷
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  operator_id TEXT,
  operator_name TEXT NOT NULL,
  operator_email TEXT,
  operator_role TEXT,
  operator_department TEXT,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  project_id UUID,
  project_name TEXT,
  target_id TEXT,
  target_name TEXT,
  summary TEXT NOT NULL,
  diffs JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator_name ON public.audit_logs(operator_name);

-- 設定權限 (Row Level Security)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 唯讀政策 (開放應用程式查詢)
CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);

-- 寫入政策 (允許 service role 與公開 insert)
CREATE POLICY "Allow service role all audit_logs" ON public.audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
