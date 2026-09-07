-- ==============================================================================
-- Supabase Migration: Create Questions and Submissions Tables with RBAC & RLS
-- ==============================================================================

-- 1. Create Questions Table (Question Bank & Presentation Metadata)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
    total_test_cases INT NOT NULL DEFAULT 5 CHECK (total_test_cases >= 0),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    topic TEXT,
    sub_topic TEXT,
    language TEXT DEFAULT 'java',
    starter_code TEXT,
    test_cases JSONB DEFAULT '[]'::jsonb,
    task TEXT,
    input_format TEXT,
    constraints TEXT,
    output_format TEXT,
    explanation TEXT,
    contents JSONB DEFAULT '[]'::jsonb,
    score INT DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Lookup Indexes for Questions
CREATE INDEX IF NOT EXISTS questions_display_order_idx ON public.questions (display_order);
CREATE INDEX IF NOT EXISTS questions_slug_idx ON public.questions (slug);
CREATE INDEX IF NOT EXISTS questions_is_active_idx ON public.questions (is_active);

-- Automatic Updated-At Trigger for Questions
DROP TRIGGER IF EXISTS set_questions_updated_at ON public.questions;
CREATE TRIGGER set_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create Submissions Table (Per-User Progress and Attempt History)
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    cases_passed INT NOT NULL CHECK (cases_passed >= 0),
    total_cases INT NOT NULL DEFAULT 5 CHECK (total_cases >= 0),
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'partial')),
    submitted_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Fast Progress Lookups & Analytics
CREATE INDEX IF NOT EXISTS submissions_user_question_idx ON public.submissions (user_id, question_id);
CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS submissions_question_id_idx ON public.submissions (question_id);
CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON public.submissions (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 4. Row Level Security Policies for Questions Table

-- Policy 1: Authenticated users can view active questions; Admins & Trainers can view all
CREATE POLICY "Authenticated users can view active questions"
    ON public.questions
    FOR SELECT
    USING (
        is_active = true
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role IN ('admin', 'trainer')
        )
    );

-- Policy 2: Only administrators can insert new questions
CREATE POLICY "Admins can insert questions"
    ON public.questions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 3: Only administrators can update questions
CREATE POLICY "Admins can update questions"
    ON public.questions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 4: Only administrators can delete questions
CREATE POLICY "Admins can delete questions"
    ON public.questions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- 5. Row Level Security Policies for Submissions Table

-- Policy 1: Users can view their own submissions; Admins and Trainers can view all submissions
CREATE POLICY "Users can view own submissions"
    ON public.submissions
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role IN ('admin', 'trainer')
        )
    );

-- Policy 2: Users can insert their own submissions
CREATE POLICY "Users can insert own submissions"
    ON public.submissions
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 3: Admins can delete submissions if needed for moderation
CREATE POLICY "Admins can delete submissions"
    ON public.submissions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- ==============================================================================
-- 6. Initial Seed Data: Existing Question Bank
-- ==============================================================================
INSERT INTO public.questions (
    title,
    slug,
    description,
    difficulty,
    total_test_cases,
    display_order,
    is_active,
    topic,
    sub_topic,
    language,
    starter_code,
    test_cases,
    contents
)
VALUES
(
    'Positive Number Checker',
    'check-positive-number',
    'Write a Java program that takes an integer num as input and checks if it is a Positive Number using an if statement.',
    'easy',
    5,
    1,
    true,
    'Decision-making statements',
    'Practice Problem: Positive Number Check',
    'java',
    'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        \n        // Write your if condition here\n        if (num > 0) {\n            System.out.println(num + " is a positive number.");\n        }\n    }\n}',
    '[
        {"id": 1, "name": "Sample 1", "input": "12", "expectedOutput": "12 is a positive number.", "isHidden": false},
        {"id": 2, "name": "Sample 2", "input": "-25", "expectedOutput": "", "isHidden": false},
        {"id": 3, "name": "Hidden 1", "input": "-5", "expectedOutput": "", "isHidden": true},
        {"id": 4, "name": "Hidden 2", "input": "0", "expectedOutput": "", "isHidden": true},
        {"id": 5, "name": "Hidden 3", "input": "100", "expectedOutput": "100 is a positive number.", "isHidden": true}
    ]'::jsonb,
    '[
        {"text": "<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement."},
        {"text": "<b>Sample Input:</b> <code>12</code>"},
        {"text": "<b>Expected Output:</b><br><code>12 is a positive number.</code>"}
    ]'::jsonb
),
(
    'Sum of Digits',
    'sum-of-digits',
    'Write a Java program that takes an integer num as input and prints the Sum of its Digits.',
    'easy',
    6,
    2,
    true,
    'Decision-making statements',
    'Practice Problem: Sum of Digits',
    'java',
    'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        int sum = 0;\n        \n        // Write your logic here to calculate sum of digits\n        int temp = Math.abs(num);\n        while (temp > 0) {\n            sum += temp % 10;\n            temp /= 10;\n        }\n        \n        System.out.println("Sum of digits = " + sum);\n    }\n}',
    '[
        {"id": 1, "name": "Sample 1", "input": "123", "expectedOutput": "Sum of digits = 6", "isHidden": false},
        {"id": 2, "name": "Sample 2", "input": "9", "expectedOutput": "Sum of digits = 9", "isHidden": false},
        {"id": 3, "name": "Hidden 1", "input": "1000", "expectedOutput": "Sum of digits = 1", "isHidden": true},
        {"id": 4, "name": "Hidden 2", "input": "0", "expectedOutput": "Sum of digits = 0", "isHidden": true},
        {"id": 5, "name": "Hidden 3", "input": "987654", "expectedOutput": "Sum of digits = 39", "isHidden": true},
        {"id": 6, "name": "Hidden 4", "input": "505", "expectedOutput": "Sum of digits = 10", "isHidden": true}
    ]'::jsonb,
    '[
        {"text": "<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>."},
        {"text": "<b>Sample Input:</b> <code>123</code>"},
        {"text": "<b>Expected Output:</b><br><code>Sum of digits = 6</code>"}
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    difficulty = EXCLUDED.difficulty,
    total_test_cases = EXCLUDED.total_test_cases,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    topic = EXCLUDED.topic,
    sub_topic = EXCLUDED.sub_topic,
    language = EXCLUDED.language,
    starter_code = EXCLUDED.starter_code,
    test_cases = EXCLUDED.test_cases,
    contents = EXCLUDED.contents,
    updated_at = now();
