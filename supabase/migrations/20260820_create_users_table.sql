-- ==============================================================================
-- Supabase Migration: Create Users Table & RBAC Security Policies
-- ==============================================================================

-- 1. Create Enum Type for User Roles with explicit integrity constraints
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Case-insensitive unique index to guarantee uniqueness across case variations
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (LOWER(email));

-- 3. Automatic Updated-At Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies

-- Policy 1: Any authenticated user can read their own profile row
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    USING (
        auth.uid() = id
        OR LOWER(auth.jwt() ->> 'email') = LOWER(email)
    );

-- Policy 2: Admin users can view all users
CREATE POLICY "Admins can view all users"
    ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 3: Public inserts are disabled. Only admin users can insert new users via client,
-- or backend service-role operations (which bypass RLS).
CREATE POLICY "Admins can insert users"
    ON public.users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 4: Admins can update users (non-admins cannot update other users or modify their own role)
CREATE POLICY "Admins can update users"
    ON public.users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- Policy 5: Admins can delete users
CREATE POLICY "Admins can delete users"
    ON public.users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR LOWER(u.email) = LOWER(auth.jwt() ->> 'email'))
            AND u.role = 'admin'
        )
    );

-- ==============================================================================
-- Initial Bootstrap Seed (Example)
-- Replace with your organization's initial administrator email
-- ==============================================================================
-- INSERT INTO public.users (email, role)
-- VALUES 
--   ('admin@example.com', 'admin'),
--   ('trainer@example.com', 'trainer'),
--   ('student@example.com', 'student')
-- ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;
