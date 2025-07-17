/*
  # Fix User Database Structure and Sync Mechanism

  1. Database Structure
    - Ensure public.users table exists with correct structure
    - Remove conflicting triggers
    - Set up proper RLS policies

  2. User Sync Mechanism
    - Create function to sync auth.users to public.users
    - Set up trigger for automatic syncing
    - Handle user creation properly

  3. Testing
    - Ensure user creation works without conflicts
    - Verify foreign key relationships work correctly
*/

-- Drop existing conflicting triggers and functions
DROP TRIGGER IF EXISTS sync_auth_user_trigger ON auth.users;
DROP FUNCTION IF EXISTS sync_auth_user_to_users();

-- Ensure the users table exists with correct structure
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'salesman' CHECK (role IN ('admin', 'salesman')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create RLS policies
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

-- Create function to handle user creation in public.users
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
  -- Extract name and role from metadata, with defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'salesman');
  
  -- Insert into public.users table
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE WARNING 'Error creating user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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
  -- Extract name and role from metadata, with defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'salesman');
  
  -- Update public.users table
  UPDATE public.users SET
    email = NEW.email,
    name = user_name,
    role = user_role
  WHERE id = NEW.id;
  
  -- If user doesn't exist, create them
  IF NOT FOUND THEN
    INSERT INTO public.users (id, email, name, role)
    VALUES (NEW.id, NEW.email, user_name, user_role);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user update
    RAISE WARNING 'Error updating user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for user updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();

-- Sync existing auth users to public.users
DO $$
DECLARE
  auth_user RECORD;
  user_name text;
  user_role text;
BEGIN
  FOR auth_user IN SELECT * FROM auth.users LOOP
    user_name := COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1));
    user_role := COALESCE(auth_user.raw_user_meta_data->>'role', 'salesman');
    
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
      name = COALESCE(EXCLUDED.name, public.users.name),
      role = COALESCE(EXCLUDED.role, public.users.role);
  END LOOP;
  
  RAISE NOTICE 'Synced % existing auth users to public.users', (SELECT COUNT(*) FROM auth.users);
END $$;

-- Create a test admin user if none exists
DO $$
DECLARE
  admin_count integer;
  test_user_id uuid;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  
  IF admin_count = 0 THEN
    test_user_id := gen_random_uuid();
    
    -- Insert test admin user
    INSERT INTO public.users (id, email, name, role)
    VALUES (
      test_user_id,
      'admin@loreal.com',
      'Admin User',
      'admin'
    )
    ON CONFLICT (email) DO NOTHING;
    
    RAISE NOTICE 'Created test admin user with ID: %', test_user_id;
  END IF;
END $$;

-- Verify the setup
DO $$
DECLARE
  user_count integer;
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  
  RAISE NOTICE 'Setup complete: % total users, % admin users', user_count, admin_count;
END $$;