/*
  # Sync Auth Users to Custom Users Table

  1. Check and create users table structure if needed
  2. Sync existing auth users to custom users table
  3. Create sample stores with proper user references
  4. Add trigger to auto-sync new auth users

  This migration ensures that:
  - All auth users are properly synced to our custom users table
  - Foreign key constraints are satisfied
  - Sample data can be created successfully
*/

-- Ensure users table exists with correct structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'salesman')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users users_1
    WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
  ));

-- Function to sync auth user to custom users table
CREATE OR REPLACE FUNCTION sync_auth_user_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert new user into custom users table
  INSERT INTO users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'salesman')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name);
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-sync new auth users
DROP TRIGGER IF EXISTS sync_auth_user_trigger ON auth.users;
CREATE TRIGGER sync_auth_user_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_to_users();

-- Sync existing auth users to custom users table
INSERT INTO users (id, email, name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
  COALESCE(au.raw_user_meta_data->>'role', 'salesman') as role
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, users.name),
  role = COALESCE(EXCLUDED.role, users.role);

-- Create a default admin user if no users exist
DO $$
DECLARE
    admin_user_id uuid;
    user_count integer;
BEGIN
    -- Check if we have any users
    SELECT COUNT(*) INTO user_count FROM users;
    
    IF user_count = 0 THEN
        -- Create a default admin user entry
        -- Note: This creates a placeholder that will be updated when real auth happens
        admin_user_id := '6bcf38c5-d1e3-4a68-956d-bd9334536210'::uuid;
        
        -- Insert into auth.users first (this is a placeholder)
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
        VALUES (
            admin_user_id,
            'admin@loreal.com',
            crypt('admin123', gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"role": "admin", "name": "Admin User"}'::jsonb
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert into custom users table
        INSERT INTO users (id, email, name, role)
        VALUES (
            admin_user_id,
            'admin@loreal.com',
            'Admin User',
            'admin'
        )
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Created default admin user: admin@loreal.com / admin123';
    END IF;
END $$;

-- Now create sample stores with proper user references
DO $$
DECLARE
    sample_user_id uuid;
BEGIN
    -- Get any available user ID (preferably admin)
    SELECT id INTO sample_user_id 
    FROM users 
    WHERE role = 'admin' 
    LIMIT 1;
    
    -- If no admin, get any user
    IF sample_user_id IS NULL THEN
        SELECT id INTO sample_user_id FROM users LIMIT 1;
    END IF;
    
    -- Create sample stores if we have a valid user
    IF sample_user_id IS NOT NULL THEN
        INSERT INTO stores (store_code, store_name, address, route, phone, average_order_value, order_frequency, key_contact, created_by) VALUES
        ('BC001', 'Beauty Corner', 'Jl. Sudirman No. 123, Jakarta Pusat', 'A', '+62 21 1234 5678', 450.00, 'Weekly', 'Sarah Johnson', sample_user_id),
        ('GB002', 'Glamour Boutique', 'Jl. Thamrin No. 456, Jakarta Selatan', 'B', '+62 21 9876 5432', 680.00, 'Bi-weekly', 'Mike Chen', sample_user_id),
        ('SS003', 'Style Studio', 'Jl. Kemang No. 789, Jakarta Selatan', 'A', '+62 21 4567 8901', 320.00, 'Monthly', 'Emma Davis', sample_user_id),
        ('MB004', 'Makeup Boutique', 'Jl. Senayan No. 321, Jakarta Selatan', 'C', '+62 21 2468 1357', 520.00, 'Weekly', 'Lisa Wong', sample_user_id),
        ('GS005', 'Glamour Store', 'Jl. Menteng No. 654, Jakarta Pusat', 'B', '+62 21 1357 2468', 380.00, 'Bi-weekly', 'David Kim', sample_user_id)
        ON CONFLICT (store_code) DO NOTHING;
        
        RAISE NOTICE 'Sample stores created successfully with user ID: %', sample_user_id;
    ELSE
        RAISE NOTICE 'No users available - stores will be created when users register';
    END IF;
END $$;

-- Insert additional sample products
INSERT INTO products (sku_code, product_name, category, unit_price, is_active) VALUES
('LOR006', 'L''Oréal Paris Lipstick Rouge', 'Makeup', 18.99, true),
('LOR007', 'Garnier Fructis Conditioner', 'Hair Care', 9.49, true),
('LOR008', 'Maybelline Concealer', 'Makeup', 11.99, true),
('LOR009', 'L''Oréal Paris Serum', 'Skincare', 29.99, true),
('LOR010', 'Garnier BB Cream', 'Makeup', 13.99, true)
ON CONFLICT (sku_code) DO NOTHING;

-- Update existing promotions and add new ones
INSERT INTO promotions (product_id, promo_name, discount_percentage, start_date, end_date, is_active)
SELECT 
  p.id,
  'New Year Special - ' || p.product_name,
  25.0,
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '20 days',
  true
FROM products p 
WHERE p.sku_code IN ('LOR006', 'LOR008', 'LOR010')
ON CONFLICT DO NOTHING;

-- Function to create sample data for new users
CREATE OR REPLACE FUNCTION create_sample_data_for_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create sample stores for the user if they don't exist
    INSERT INTO stores (store_code, store_name, address, route, phone, average_order_value, order_frequency, key_contact, created_by)
    SELECT 
        'USR' || substr(user_id::text, 1, 3) || '01',
        'Sample Store 1',
        'Jl. Sample No. 123, Jakarta',
        'A',
        '+62 21 1111 1111',
        400.00,
        'Weekly',
        'Sample Contact',
        user_id
    WHERE NOT EXISTS (
        SELECT 1 FROM stores WHERE created_by = user_id
    );
    
    RAISE NOTICE 'Sample data created for user: %', user_id;
END;
$$;