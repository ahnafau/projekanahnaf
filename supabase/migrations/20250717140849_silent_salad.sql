/*
  # Create MSL (Must Selling List) Management System

  1. New Tables
    - `msl_items`
      - `id` (uuid, primary key)
      - `category` (text, store category)
      - `sku_code` (text, product SKU)
      - `product_name` (text, product name)
      - `priority` (integer, priority order)
      - `notes` (text, optional notes)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `msl_items` table
    - Add policies for admin management and user read access

  3. Indexes
    - Index on category for fast filtering
    - Index on priority for ordering
    - Unique constraint on category + sku_code
*/

CREATE TABLE IF NOT EXISTS msl_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  sku_code text NOT NULL,
  product_name text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category, sku_code)
);

-- Enable RLS
ALTER TABLE msl_items ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_msl_items_category ON msl_items(category);
CREATE INDEX IF NOT EXISTS idx_msl_items_priority ON msl_items(category, priority);

-- RLS Policies
CREATE POLICY "Admins can manage MSL items"
  ON msl_items
  FOR ALL
  TO authenticated
  USING (is_admin_from_users())
  WITH CHECK (is_admin_from_users());

CREATE POLICY "Users can read MSL items"
  ON msl_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Update trigger
CREATE TRIGGER update_msl_items_updated_at
  BEFORE UPDATE ON msl_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample MSL data for testing
INSERT INTO msl_items (category, sku_code, product_name, priority, notes) VALUES
('GT PROV', 'LOR001', 'L''Oreal Paris Voluminous Mascara', 1, 'Top seller - high margin'),
('GT PROV', 'LOR002', 'L''Oreal Paris Foundation', 2, 'Popular shade range'),
('GT PROV', 'GAR001', 'Garnier Fructis Shampoo', 3, 'Volume driver'),
('GT PROV', 'MAY001', 'Maybelline Lipstick', 4, 'Trending colors'),
('GT PROV', 'LOR003', 'L''Oreal Hair Color', 5, 'Professional quality'),
('GT Wholesale', 'LOR004', 'L''Oreal Wholesale Pack A', 1, 'Bulk discount available'),
('GT Wholesale', 'GAR002', 'Garnier Wholesale Bundle', 2, 'High volume product'),
('GT Wholesale', 'MAY002', 'Maybelline Display Set', 3, 'Complete range'),
('GT Small Cosmetics', 'LOR005', 'L''Oreal Mini Lipstick Set', 1, 'Perfect for small stores'),
('GT Small Cosmetics', 'GAR003', 'Garnier Travel Size', 2, 'Impulse purchase'),
('GT Small Cosmetics', 'MAY003', 'Maybelline Compact Mirror', 3, 'High margin accessory')
ON CONFLICT (category, sku_code) DO NOTHING;