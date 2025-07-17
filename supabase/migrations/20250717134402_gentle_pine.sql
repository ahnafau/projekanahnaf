/*
  # Make store categories dynamic

  1. Changes
    - Remove category constraint to allow any category value
    - Keep default value for backward compatibility
    - Categories will be managed dynamically from CSV imports and form inputs

  2. Security
    - Maintain existing RLS policies
    - No changes to permissions structure
*/

-- Remove the category constraint to allow any category value
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_category_check;

-- Update the default value to be more generic
ALTER TABLE stores ALTER COLUMN category SET DEFAULT 'General';