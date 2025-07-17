/*
  # Remove route check constraint

  1. Changes
    - Remove the check constraint on stores.route column that restricts values to A, B, C, D
    - Allow any route value to be stored in the database

  2. Security
    - No RLS changes needed
    - Maintains existing security policies
*/

-- Remove the route check constraint to allow dynamic route values
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_route_check;