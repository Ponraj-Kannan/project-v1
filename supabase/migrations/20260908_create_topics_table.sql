-- ==============================================================================
-- Supabase Migration: Create Topics Table (id, name, display_order)
-- ==============================================================================

-- 1. Create Topics Table with ONLY id, name, display_order
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);

-- Indexes for Fast Sorting and Lookups
CREATE INDEX IF NOT EXISTS topics_name_idx ON public.topics (name);
CREATE INDEX IF NOT EXISTS topics_display_order_idx ON public.topics (display_order);

-- 2. Add topic_id column to questions if not present
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questions_topic_id_idx ON public.questions (topic_id);

-- 3. Seed Default Topics with sequential display_order
INSERT INTO public.topics (name, display_order)
VALUES 
    ('Decision-making statements', 1),
    ('Arrays', 2),
    ('Strings', 3),
    ('Loops & Iteration', 4),
    ('Methods & Functions', 5),
    ('Object-Oriented Programming', 6),
    ('Recursion', 7),
    ('Data Structures', 8),
    ('Core Concepts', 9)
ON CONFLICT (name) DO NOTHING;

-- Also seed any distinct topics currently present in questions
INSERT INTO public.topics (name, display_order)
SELECT DISTINCT topic, 10
FROM public.questions 
WHERE topic IS NOT NULL AND TRIM(topic) != ''
ON CONFLICT (name) DO NOTHING;

-- 4. Link existing questions to topics by name match
UPDATE public.questions q
SET topic_id = t.id
FROM public.topics t
WHERE q.topic = t.name AND q.topic_id IS NULL;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to topics
DROP POLICY IF EXISTS "Allow public read access on topics" ON public.topics;
CREATE POLICY "Allow public read access on topics"
    ON public.topics
    FOR SELECT
    USING (true);

-- Allow authenticated admins full access to topics
DROP POLICY IF EXISTS "Allow admin full access on topics" ON public.topics;
CREATE POLICY "Allow admin full access on topics"
    ON public.topics
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 6. Enable Realtime broadcast for topics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'topics'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.topics;
    END IF;
END $$;
