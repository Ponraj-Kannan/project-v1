-- ==============================================================================
-- Supabase Migration: Recreate Schema for Users, Questions, and Submissions
-- ==============================================================================

-- ==========================================
-- 1. Create User Role Enum Type
-- ==========================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 2. Create Users Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));

-- ==========================================
-- 3. Create Questions Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  total_test_cases INT NOT NULL DEFAULT 5,
  display_order INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  topic TEXT,
  sub_topic TEXT,
  language TEXT NOT NULL DEFAULT 'java',
  starter_code TEXT,
  test_cases JSONB DEFAULT '[]'::jsonb,
  task TEXT,
  input_format TEXT,
  constraints TEXT,
  output_format TEXT,
  explanation TEXT,
  contents JSONB DEFAULT '[]'::jsonb,
  score INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sequential curriculum ordering
CREATE INDEX IF NOT EXISTS idx_questions_display_order ON public.questions (display_order);

-- ==========================================
-- 4. Create Submissions Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  cases_passed INT NOT NULL DEFAULT 0,
  total_cases INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'failed',
  submitted_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast progress calculations
CREATE INDEX IF NOT EXISTS idx_submissions_user_question ON public.submissions (user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions (created_at DESC);

-- ==========================================
-- 5. Enable Real-Time Broadcasts
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- ==========================================
-- 6. Row Level Security (RLS) Policies
-- Allow anon client to read and manage records for the admin dashboard
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon on users" 
  ON public.users FOR ALL 
  TO anon 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anon on questions" 
  ON public.questions FOR ALL 
  TO anon 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anon on submissions" 
  ON public.submissions FOR ALL 
  TO anon 
  USING (true) 
  WITH CHECK (true);
