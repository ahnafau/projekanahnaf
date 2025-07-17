/*
  # Fix RLS Policy Infinite Recursion

  1. Problem
    - Current RLS policies are causing infinite recursion when checking user roles
    - Policies that reference the users table are creating circular dependencies
    - This affects stores, products, visits, and other tables

  2. Solution
    - Simplify policies to avoid complex subqueries
    - Use direct auth.uid() comparisons where possible
    - Remove recursive user role checks that cause infinite loops
    - Create more efficient policies that don't cause circular references

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies
    - Ensure admin access without recursive checks
    - Use function-based approach for role checking
*/

-- First, let's create a function to safely check if a user is admin
-- This avoids the infinite recursion by using a direct query
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  );
$$;

-- Alternative function using the users table if role is stored there
CREATE OR REPLACE FUNCTION is_admin_from_users()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM users WHERE id = auth.uid()),
    false
  );
$$;

-- Drop existing problematic policies for users table
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create simplified users policies without recursion
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Drop existing problematic policies for stores table
DROP POLICY IF EXISTS "Users can create stores" ON stores;
DROP POLICY IF EXISTS "Users can read own stores" ON stores;
DROP POLICY IF EXISTS "Users can update own stores" ON stores;

-- Create simplified stores policies
CREATE POLICY "Users can create stores"
  ON stores
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can read own stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can update own stores"
  ON stores
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Admin access to stores (simplified)
CREATE POLICY "Admins can manage all stores"
  ON stores
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());

-- Drop existing problematic policies for products table
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Everyone can read active products" ON products;

-- Create simplified products policies
CREATE POLICY "Everyone can read active products"
  ON products
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
  ON products
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());

-- Drop existing problematic policies for visits table
DROP POLICY IF EXISTS "Users can create own visits" ON visits;
DROP POLICY IF EXISTS "Users can read own visits" ON visits;
DROP POLICY IF EXISTS "Users can update own visits" ON visits;

-- Create simplified visits policies
CREATE POLICY "Users can create own visits"
  ON visits
  FOR INSERT
  TO authenticated
  WITH CHECK (salesman_id = auth.uid());

CREATE POLICY "Users can read own visits"
  ON visits
  FOR SELECT
  TO authenticated
  USING (salesman_id = auth.uid());

CREATE POLICY "Users can update own visits"
  ON visits
  FOR UPDATE
  TO authenticated
  USING (salesman_id = auth.uid());

-- Admin access to visits (simplified)
CREATE POLICY "Admins can manage all visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());

-- Drop existing problematic policies for visit_orders table
DROP POLICY IF EXISTS "Users can create visit orders" ON visit_orders;
DROP POLICY IF EXISTS "Users can read own visit orders" ON visit_orders;
DROP POLICY IF EXISTS "Users can update own visit orders" ON visit_orders;

-- Create simplified visit_orders policies
CREATE POLICY "Users can create visit orders"
  ON visit_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM visits 
      WHERE visits.id = visit_orders.visit_id 
      AND visits.salesman_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own visit orders"
  ON visit_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM visits 
      WHERE visits.id = visit_orders.visit_id 
      AND visits.salesman_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own visit orders"
  ON visit_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM visits 
      WHERE visits.id = visit_orders.visit_id 
      AND visits.salesman_id = auth.uid()
    )
  );

-- Admin access to visit_orders (simplified)
CREATE POLICY "Admins can manage all visit orders"
  ON visit_orders
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());

-- Drop existing problematic policies for promotions table
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Everyone can read active promotions" ON promotions;

-- Create simplified promotions policies
CREATE POLICY "Everyone can read active promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage promotions"
  ON promotions
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());