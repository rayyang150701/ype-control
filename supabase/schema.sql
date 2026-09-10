-- ==============================================================================
-- 燁輝智慧製造執行方案進度管制表 - Supabase PostgreSQL Schema
-- ==============================================================================

-- 啟用 UUID 擴充功能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 重建乾淨的資料表結構 (由於新專案尚無資料，清空以防欄位型態不一致)
DROP TABLE IF EXISTS public.progress_logs CASCADE;
DROP TABLE IF EXISTS public.sub_projects CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. 成員資料表 (Users)
CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'viewer',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 主專案資料表 (Projects)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  project_purpose TEXT DEFAULT '',
  current_status_and_issues TEXT DEFAULT '',
  yieh_phui_project_manager TEXT DEFAULT '',
  tpm_office_contact TEXT DEFAULT '',
  egiga_contact TEXT DEFAULT '',
  is_on_hold BOOLEAN DEFAULT FALSE,
  on_hold_reason TEXT DEFAULT '',
  on_hold_start_date TIMESTAMPTZ,
  on_hold_end_date TIMESTAMPTZ,
  on_hold_notes TEXT DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  firebase_id TEXT UNIQUE
);

-- 3. 子專案資料表 (Sub Projects)
CREATE TABLE IF NOT EXISTS public.sub_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner TEXT,
  expected_completion_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  is_on_hold BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  firebase_id TEXT UNIQUE
);

-- 4. 週報進度紀錄表 (Progress Logs)
CREATE TABLE IF NOT EXISTS public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_project_id UUID NOT NULL REFERENCES public.sub_projects(id) ON DELETE CASCADE,
  reporting_period TEXT,
  execution_summary TEXT DEFAULT '',
  next_week_plan TEXT DEFAULT '',
  roadblocks TEXT DEFAULT '',
  completion_percentage INTEGER DEFAULT 0,
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  firebase_id TEXT UNIQUE
);

-- 建立索引以確保查詢效能
CREATE INDEX IF NOT EXISTS idx_projects_case_number ON public.projects(case_number);
CREATE INDEX IF NOT EXISTS idx_sub_projects_project_id ON public.sub_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_sub_project_id ON public.progress_logs(sub_project_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_updated_at ON public.progress_logs(updated_at DESC);

-- 設定權限 (開放公開讀取，供訪客模式使用)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

-- 訪客唯讀政策
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public read sub_projects" ON public.sub_projects FOR SELECT USING (true);
CREATE POLICY "Allow public read progress_logs" ON public.progress_logs FOR SELECT USING (true);

-- 允許 Service Role 全權存取
CREATE POLICY "Allow service role all users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role all projects" ON public.projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role all sub_projects" ON public.sub_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role all progress_logs" ON public.progress_logs FOR ALL USING (auth.role() = 'service_role');
