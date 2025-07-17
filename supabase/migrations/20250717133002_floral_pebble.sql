/*
  # Add Store Categories Enhancement

  1. Database Changes
    - Add `category` column to stores table with predefined values
    - Update existing stores with default category
    - Add index for better performance

  2. Categories
    - GT PROV (GT Provincial)
    - GT Wholesale 
    - GT Small Cosmetics

  3. Constraints
    - Category is required (NOT NULL)
    - Only allow predefined category values
*/

-- Add category column to stores table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'category'
  ) THEN
    ALTER TABLE stores ADD COLUMN category text NOT NULL DEFAULT 'GT Small Cosmetics';
  END IF;
END $$;

-- Add check constraint for category values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'stores_category_check'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_category_check 
    CHECK (category IN ('GT PROV', 'GT Wholesale', 'GT Small Cosmetics'));
  END IF;
END $$;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category);

-- Update existing stores with varied categories for demo
UPDATE stores SET category = 'GT PROV' WHERE id IN (
  SELECT id FROM stores ORDER BY created_at LIMIT (SELECT COUNT(*) / 3 FROM stores)
);

UPDATE stores SET category = 'GT Wholesale' WHERE id IN (
  SELECT id FROM stores WHERE category = 'GT Small Cosmetics' ORDER BY created_at LIMIT (SELECT COUNT(*) / 3 FROM stores WHERE category = 'GT Small Cosmetics')
);