-- ==============================================================================
-- Supabase Migration: Enforce Fixed 10 Topics and Question Priority
-- ==============================================================================

-- 1. Ensure topics table exists
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);

-- 2. Upsert the 10 fixed topics with sequential display_order
INSERT INTO public.topics (id, name, display_order)
VALUES 
    ('66d11752-20ab-48fe-88f2-9c335262ef57', 'Inputs', 1),
    ('0ca140b9-a466-434e-8f76-d11832c35751', 'Outputs', 2),
    ('6d7bbce7-23de-44a3-8bbf-fa68a3f689f9', 'Operators', 3),
    ('8a1cb44b-a608-4729-8db3-e38def002dba', 'Type Casting', 4),
    ('8b03f493-6051-4aee-91d7-065e941a85f9', 'Decision-making Statements', 5),
    ('8c146688-03b9-4afb-8668-d382b78b9d5e', 'Control Statements', 6),
    ('9963ab60-2f29-46b4-ab6d-a670253649e0', 'Arrays', 7),
    ('a7bbae11-253c-4cdd-bb75-10ffd7fdd668', 'Strings', 8),
    ('c2b281ab-f9f5-41a0-b9dd-2632a30c19ba', 'Methods / Functions', 9),
    ('aa998cdd-cc76-48cd-89cc-7ed0d5887e22', 'Recursion', 10)
ON CONFLICT (name) DO UPDATE 
SET display_order = EXCLUDED.display_order;

-- 3. Add priority column to questions table if not present
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 1;

-- Backfill priority from display_order for existing records
UPDATE public.questions 
SET priority = display_order 
WHERE priority IS NULL;

-- 4. Add topic_id column if not present
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;

-- 5. Link questions to topics by matching name (case-insensitive)
UPDATE public.questions q
SET topic_id = t.id
FROM public.topics t
WHERE LOWER(q.topic) = LOWER(t.name) AND (q.topic_id IS NULL OR q.topic_id != t.id);

-- 6. Add composite indexes for fast topic filtering and priority ordering
CREATE INDEX IF NOT EXISTS idx_questions_topic_priority ON public.questions (topic, priority);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id_priority ON public.questions (topic_id, priority);
CREATE INDEX IF NOT EXISTS idx_questions_priority ON public.questions (priority);
