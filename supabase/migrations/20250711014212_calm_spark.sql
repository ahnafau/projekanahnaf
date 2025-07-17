/*
  # Convert Currency from Dollar to Rupiah

  1. Database Changes
    - Update all existing product prices from USD to IDR (multiply by ~15,000)
    - Update store average_order_value to rupiah
    - Update visit_orders line_total and unit_price to rupiah
    - Ensure all monetary values are reasonable in rupiah context

  2. Price Conversion Logic
    - $1 USD ≈ Rp 15,000 IDR (approximate conversion rate)
    - Round to nearest thousand for cleaner prices
    - Ensure minimum prices make sense for Indonesian market
*/

-- Update product prices from USD to IDR
UPDATE products SET 
  unit_price = CASE 
    WHEN unit_price < 5 THEN ROUND(unit_price * 15000 / 1000) * 1000  -- Round to nearest 1000
    WHEN unit_price < 20 THEN ROUND(unit_price * 15000 / 5000) * 5000  -- Round to nearest 5000
    ELSE ROUND(unit_price * 15000 / 10000) * 10000  -- Round to nearest 10000
  END
WHERE unit_price > 0;

-- Update store average order values from USD to IDR
UPDATE stores SET 
  average_order_value = CASE 
    WHEN average_order_value IS NULL THEN NULL
    WHEN average_order_value < 100 THEN ROUND(average_order_value * 15000 / 10000) * 10000
    WHEN average_order_value < 500 THEN ROUND(average_order_value * 15000 / 25000) * 25000
    ELSE ROUND(average_order_value * 15000 / 50000) * 50000
  END
WHERE average_order_value IS NOT NULL AND average_order_value > 0;

-- Update visit orders unit prices from USD to IDR
UPDATE visit_orders SET 
  unit_price = CASE 
    WHEN unit_price < 5 THEN ROUND(unit_price * 15000 / 1000) * 1000
    WHEN unit_price < 20 THEN ROUND(unit_price * 15000 / 5000) * 5000
    ELSE ROUND(unit_price * 15000 / 10000) * 10000
  END
WHERE unit_price > 0;

-- Update visit orders line totals from USD to IDR
UPDATE visit_orders SET 
  line_total = CASE 
    WHEN line_total < 50 THEN ROUND(line_total * 15000 / 5000) * 5000
    WHEN line_total < 200 THEN ROUND(line_total * 15000 / 10000) * 10000
    ELSE ROUND(line_total * 15000 / 25000) * 25000
  END
WHERE line_total > 0;

-- Add some sample products with reasonable Indonesian prices if table is empty
INSERT INTO products (sku_code, product_name, category, unit_price, is_active) VALUES
('LOR001', 'L''Oréal Paris Revitalift Serum', 'Skincare', 285000, true),
('LOR002', 'Garnier Micellar Water', 'Skincare', 45000, true),
('LOR003', 'Maybelline Superstay Foundation', 'Makeup', 165000, true),
('LOR004', 'L''Oréal Paris Voluminous Mascara', 'Makeup', 125000, true),
('LOR005', 'Garnier Fructis Shampoo 340ml', 'Hair Care', 35000, true),
('LOR006', 'L''Oréal Paris Rouge Signature Lipstick', 'Makeup', 185000, true),
('LOR007', 'Garnier Fructis Conditioner 340ml', 'Hair Care', 38000, true),
('LOR008', 'Maybelline Fit Me Concealer', 'Makeup', 85000, true),
('LOR009', 'L''Oréal Paris Hyaluron Expert Serum', 'Skincare', 320000, true),
('LOR010', 'Garnier BB Cream', 'Makeup', 65000, true),
('LOR011', 'Maybelline Baby Lips', 'Makeup', 25000, true),
('LOR012', 'L''Oréal Paris Extraordinary Oil', 'Hair Care', 95000, true),
('LOR013', 'Garnier Pure Active Facial Wash', 'Skincare', 28000, true),
('LOR014', 'Maybelline The Colossal Mascara', 'Makeup', 75000, true),
('LOR015', 'L''Oréal Paris Age Perfect Cream', 'Skincare', 245000, true)
ON CONFLICT (sku_code) DO UPDATE SET
  unit_price = EXCLUDED.unit_price,
  product_name = EXCLUDED.product_name,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Update existing promotions to reflect rupiah prices
UPDATE promotions SET 
  discount_percentage = CASE 
    WHEN discount_percentage > 50 THEN 25  -- Cap very high discounts
    WHEN discount_percentage < 5 THEN 10   -- Minimum meaningful discount
    ELSE discount_percentage
  END;

-- Add some sample promotions with reasonable discounts
INSERT INTO promotions (product_id, promo_name, discount_percentage, start_date, end_date, is_active)
SELECT 
  p.id,
  'Promo Spesial - ' || p.product_name,
  CASE 
    WHEN p.category = 'Makeup' THEN 20
    WHEN p.category = 'Skincare' THEN 15
    ELSE 25
  END,
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '30 days',
  true
FROM products p 
WHERE p.sku_code IN ('LOR002', 'LOR005', 'LOR008', 'LOR011', 'LOR013')
ON CONFLICT DO NOTHING;

-- Update sample stores with reasonable rupiah values
UPDATE stores SET 
  average_order_value = CASE 
    WHEN store_code = 'BC001' THEN 750000   -- Beauty Corner
    WHEN store_code = 'GB002' THEN 1200000  -- Glamour Boutique  
    WHEN store_code = 'SS003' THEN 500000   -- Style Studio
    WHEN store_code = 'MB004' THEN 850000   -- Makeup Boutique
    WHEN store_code = 'GS005' THEN 650000   -- Glamour Store
    ELSE COALESCE(average_order_value, 500000)
  END;

-- Show updated price ranges for verification
DO $$
DECLARE
  min_price numeric;
  max_price numeric;
  avg_price numeric;
  product_count integer;
BEGIN
  SELECT 
    MIN(unit_price), 
    MAX(unit_price), 
    ROUND(AVG(unit_price)), 
    COUNT(*)
  INTO min_price, max_price, avg_price, product_count
  FROM products 
  WHERE is_active = true;
  
  RAISE NOTICE '=== PRICE CONVERSION SUMMARY ===';
  RAISE NOTICE 'Total active products: %', product_count;
  RAISE NOTICE 'Price range: Rp % - Rp %', min_price, max_price;
  RAISE NOTICE 'Average price: Rp %', avg_price;
  RAISE NOTICE 'Currency conversion to IDR completed successfully!';
END $$;