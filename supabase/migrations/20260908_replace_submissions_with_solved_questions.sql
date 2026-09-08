-- ==============================================================================
-- Supabase Migration: Replace Submissions with Solved Questions Tracking
-- ==============================================================================

-- ==========================================
-- 1. Create Solved Questions Table
-- A question is solved by the user when all test cases are passed.
-- ==========================================
CREATE TABLE IF NOT EXISTS public.solved_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  is_solved BOOLEAN NOT NULL DEFAULT true,
  solved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_question_solved UNIQUE (user_id, question_id)
);

-- ==========================================
-- 2. Performance Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_solved_questions_user_id ON public.solved_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_solved_questions_question_id ON public.solved_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_solved_questions_solved_at ON public.solved_questions (solved_at DESC);

-- ==========================================
-- 3. Migrate Existing Passed Submissions
-- If the submissions table exists with passed attempts, migrate them.
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions') THEN
    INSERT INTO public.solved_questions (user_id, question_id, is_solved, solved_at, created_at, updated_at)
    SELECT
      user_id,
      question_id,
      true,
      MIN(created_at),
      MIN(created_at),
      NOW()
    FROM public.submissions
    WHERE status = 'passed'
    GROUP BY user_id, question_id
    ON CONFLICT (user_id, question_id) DO UPDATE
      SET is_solved = true, updated_at = NOW();

    -- Drop the submissions table completely as submissions history is no longer needed
    DROP TABLE public.submissions CASCADE;
  END IF;
END $$;

-- ==========================================
-- 4. Enable Real-Time Broadcasts
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.solved_questions;

-- ==========================================
-- 5. Row Level Security (RLS) Policies
-- Allow operations for anon/authenticated clients
-- ==========================================
ALTER TABLE public.solved_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon on solved_questions"
  ON public.solved_questions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
