SELECT table_schema, table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('procurement_workflow', 'identity', 'post_award', 'vendor_sourcing', 'governance')
  AND is_nullable = 'NO'
  AND column_default IS NULL
  AND table_name NOT LIKE '%audit%'
  AND table_name NOT LIKE '%history%'
  AND table_name NOT LIKE '%log%'
ORDER BY table_schema, table_name, ordinal_position;
