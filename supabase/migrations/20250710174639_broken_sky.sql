/*
  # Fix User Table Synchronization

  1. Clean up existing triggers and functions
  2. Create proper foreign key relationship between auth.users and public.users
  3. Set up automatic synchronization triggers
  4. Sync existing users
  5. Create test users if needed
  6. Verify the setup

  This ensures that auth.users and public.users stay in sync automatically.
*/

-- First, clean up any existing conflicting triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS sync_auth_user_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS sync_auth_user_to_users();

-- Ensure the public.users table has the correct structure
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'salesman' CHECK (role IN ('admin', 'salesman')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies to ensure they're correct
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create comprehensive RLS policies
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users users_1
    WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
  ));

CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  user_role text;
BEGIN
  -- Extract name and role from metadata with sensible defaults
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'salesman'
  );
  
  -- Validate role
  IF user_role NOT IN ('admin', 'salesman') THEN
    user_role := 'salesman';
  END IF;
  
  -- Insert into public.users table with the same ID as auth.users
  INSERT INTO public.users (id, email, name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    created_at = EXCLUDED.created_at;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent auth user creation
    RAISE WARNING 'Error syncing user to public.users table: %, User ID: %, Email: %', SQLERRM, NEW.id, NEW.email;
    RETURN NEW;
END;
$$;

-- Create function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  user_role text;
BEGIN
  -- Only proceed if email or metadata changed
  IF OLD.email = NEW.email AND OLD.raw_user_meta_data = NEW.raw_user_meta_data THEN
    RETURN NEW;
  END IF;
  
  -- Extract updated name and role
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'salesman'
  );
  
  -- Validate role
  IF user_role NOT IN ('admin', 'salesman') THEN
    user_role := 'salesman';
  END IF;
  
  -- Update existing record or create if missing
  INSERT INTO public.users (id, email, name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating user in public.users table: %, User ID: %, Email: %', SQLERRM, NEW.id, NEW.email;
    RETURN NEW;
END;
$$;

-- Create triggers to automatically sync users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();

-- Sync all existing auth users to public.users
DO $$
DECLARE
  auth_user RECORD;
  user_name text;
  user_role text;
  synced_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting sync of existing auth users...';
  
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data, created_at 
    FROM auth.users 
    ORDER BY created_at
  LOOP
    BEGIN
      -- Extract name and role with defaults
      user_name := COALESCE(
        auth_user.raw_user_meta_data->>'name',
        auth_user.raw_user_meta_data->>'full_name',
        split_part(auth_user.email, '@', 1)
      );
      
      user_role := COALESCE(
        auth_user.raw_user_meta_data->>'role',
        'salesman'
      );
      
      -- Validate role
      IF user_role NOT IN ('admin', 'salesman') THEN
        user_role := 'salesman';
      END IF;
      
      -- Insert or update user record
      INSERT INTO public.users (id, email, name, role, created_at)
      VALUES (
        auth_user.id,
        auth_user.email,
        user_name,
        user_role,
        auth_user.created_at
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        created_at = EXCLUDED.created_at;
      
      synced_count := synced_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to sync user %: %', auth_user.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Successfully synced % auth users to public.users', synced_count;
END $$;

-- Create test users if none exist
DO $$
DECLARE
  user_count integer;
  admin_user_id uuid;
  salesman_user_id uuid;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  IF user_count = 0 THEN
    RAISE NOTICE 'No users found, creating test users...';
    
    -- Create test admin user
    admin_user_id := gen_random_uuid();
    
    -- Insert into auth.users first
    INSERT INTO auth.users (
      id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      created_at, 
      updated_at,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      admin_user_id,
      'admin@loreal.com',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"name": "Admin User", "role": "admin"}'::jsonb,
      'authenticated',
      'authenticated'
    );
    
    -- Create test salesman user
    salesman_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      created_at, 
      updated_at,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      salesman_user_id,
      'salesman@loreal.com',
      crypt('salesman123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"name": "Sales Person", "role": "salesman"}'::jsonb,
      'authenticated',
      'authenticated'
    );
    
    RAISE NOTICE 'Created test users:';
    RAISE NOTICE '  Admin: admin@loreal.com / admin123';
    RAISE NOTICE '  Salesman: salesman@loreal.com / salesman123';
  END IF;
END $$;

-- Verify the setup and show results
DO $$
DECLARE
  auth_count integer;
  public_count integer;
  admin_count integer;
  salesman_count integer;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO public_count FROM public.users;
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  SELECT COUNT(*) INTO salesman_count FROM public.users WHERE role = 'salesman';
  
  RAISE NOTICE '=== USER SYNC VERIFICATION ===';
  RAISE NOTICE 'Auth users: %', auth_count;
  RAISE NOTICE 'Public users: %', public_count;
  RAISE NOTICE 'Admin users: %', admin_count;
  RAISE NOTICE 'Salesman users: %', salesman_count;
  
  IF auth_count = public_count THEN
    RAISE NOTICE 'SUCCESS: User tables are properly synced!';
  ELSE
    RAISE WARNING 'WARNING: User table counts do not match!';
  END IF;
  
  RAISE NOTICE 'User synchronization system is now active. New signups will automatically create records in both auth.users and public.users tables.';
END $$;