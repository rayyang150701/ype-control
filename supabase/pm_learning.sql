-- ==============================================================================
-- PM 學習地圖 (PM Learning Map) - Supabase PostgreSQL Schema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.pm_learning_courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  instructor_or_platform TEXT NOT NULL,
  category TEXT DEFAULT '專案管理與治理',
  description TEXT DEFAULT '',
  external_url TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  assigned_user_ids JSONB DEFAULT '[]'::jsonb,
  assigned_user_names JSONB DEFAULT '[]'::jsonb,
  default_checklist JSONB DEFAULT '[]'::jsonb,
  member_progress JSONB DEFAULT '{}'::jsonb,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_courses_category ON public.pm_learning_courses(category);
CREATE INDEX IF NOT EXISTS idx_pm_courses_updated_at ON public.pm_learning_courses(updated_at DESC);

-- RLS 政策
ALTER TABLE public.pm_learning_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read pm_learning_courses" ON public.pm_learning_courses FOR SELECT USING (true);
CREATE POLICY "Allow service role all pm_learning_courses" ON public.pm_learning_courses FOR ALL USING (auth.role() = 'service_role');
